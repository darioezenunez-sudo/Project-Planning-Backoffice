import type { Role } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('pino', () => ({
  default: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

vi.mock('@/lib/cache/tenant-cache', () => ({
  getTenantMemberFromCache: vi.fn(),
  setTenantMemberCache: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationMember: {
      findFirst: vi.fn(),
    },
  },
}));

import { getTenantMemberFromCache, setTenantMemberCache } from '@/lib/cache/tenant-cache';
import { prisma } from '@/lib/prisma';
import { withTenant } from '@/lib/middleware/with-tenant';
import { runWithContext } from '@/lib/request-context';

const mockGetTenantMemberFromCache = vi.mocked(getTenantMemberFromCache);
const mockSetTenantMemberCache = vi.mocked(setTenantMemberCache);
const mockFindFirst = vi.mocked(prisma.organizationMember.findFirst);

const ORG_ID = 'org-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const ctx = { params: Promise.resolve({}) };

function makeReq(orgId?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (orgId) headers['x-organization-id'] = orgId;
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('withTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantMemberFromCache.mockResolvedValue(null); // default: cache miss
  });

  it('returns 401 when there is no userId in the request context', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withTenant(handler);
    // Call WITHOUT runWithContext → getRequestContext() returns undefined
    const res = await wrapped(makeReq(ORG_ID), ctx);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 400 when the X-Organization-Id header is missing', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withTenant(handler);
    const res = await runWithContext({ requestId: 'req-1', userId: USER_ID }, () =>
      wrapped(makeReq(/* no header */), ctx),
    );
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when the user is not a member of the organization', async () => {
    mockFindFirst.mockResolvedValue(null);
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withTenant(handler);
    const res = await runWithContext({ requestId: 'req-2', userId: USER_ID }, () =>
      wrapped(makeReq(ORG_ID), ctx),
    );
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls the handler and passes the correct where clause to Prisma when membership is valid', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'mbr-1',
      organizationId: ORG_ID,
      userId: USER_ID,
      role: 'ADMIN' as Role,
      invitedAt: null,
      joinedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      version: 1,
    });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withTenant(handler);
    const res = await runWithContext({ requestId: 'req-3', userId: USER_ID }, () =>
      wrapped(makeReq(ORG_ID), ctx),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, userId: USER_ID },
      select: { role: true },
    });
  });

  it('returns 500 when Prisma throws', async () => {
    mockGetTenantMemberFromCache.mockResolvedValue(null);
    mockFindFirst.mockRejectedValue(new Error('DB connection lost'));
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withTenant(handler);
    const res = await runWithContext({ requestId: 'req-4', userId: USER_ID }, () =>
      wrapped(makeReq(ORG_ID), ctx),
    );
    expect(res.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
  });

  describe('tenant cache', () => {
    it('cache hit → prisma.organizationMember.findFirst is NOT called', async () => {
      mockGetTenantMemberFromCache.mockResolvedValue({ role: 'ADMIN' });
      const handler = vi.fn(() => NextResponse.json({ ok: true }));
      const wrapped = withTenant(handler);
      const res = await runWithContext({ requestId: 'req-c1', userId: USER_ID }, () =>
        wrapped(makeReq(ORG_ID), ctx),
      );
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledOnce();
      expect(mockFindFirst).not.toHaveBeenCalled();
      expect(mockSetTenantMemberCache).not.toHaveBeenCalled();
    });

    it('cache miss → findFirst is called and result is stored in cache', async () => {
      mockGetTenantMemberFromCache.mockResolvedValue(null);
      mockFindFirst.mockResolvedValue({
        id: 'mbr-2',
        organizationId: ORG_ID,
        userId: USER_ID,
        role: 'MANAGER' as Role,
        invitedAt: null,
        joinedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      });
      const handler = vi.fn(() => NextResponse.json({ ok: true }));
      const wrapped = withTenant(handler);
      const res = await runWithContext({ requestId: 'req-c2', userId: USER_ID }, () =>
        wrapped(makeReq(ORG_ID), ctx),
      );
      expect(res.status).toBe(200);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, userId: USER_ID },
        select: { role: true },
      });
      expect(mockSetTenantMemberCache).toHaveBeenCalledWith(USER_ID, ORG_ID, 'MANAGER');
    });

    it('kvGet returns null (cache unavailable) → fallback to DB without error', async () => {
      mockGetTenantMemberFromCache.mockResolvedValue(null);
      mockFindFirst.mockResolvedValue({
        id: 'mbr-3',
        organizationId: ORG_ID,
        userId: USER_ID,
        role: 'MEMBER' as Role,
        invitedAt: null,
        joinedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      });
      const handler = vi.fn(() => NextResponse.json({ ok: true }));
      const wrapped = withTenant(handler);
      const res = await runWithContext({ requestId: 'req-c3', userId: USER_ID }, () =>
        wrapped(makeReq(ORG_ID), ctx),
      );
      expect(res.status).toBe(200);
      expect(mockFindFirst).toHaveBeenCalledOnce();
      expect(mockSetTenantMemberCache).toHaveBeenCalledWith(USER_ID, ORG_ID, 'MEMBER');
    });
  });
});
