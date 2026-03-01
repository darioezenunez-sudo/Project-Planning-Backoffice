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

import { hasMinimumRole, ROLE_HIERARCHY, withRole } from '@/lib/middleware/with-role';
import { runWithContext } from '@/lib/request-context';

const ctx = { params: Promise.resolve({}) };
function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/test');
}

describe('ROLE_HIERARCHY', () => {
  it('VIEWER has the lowest rank', () => {
    expect(ROLE_HIERARCHY.VIEWER).toBe(0);
  });

  it('SUPER_ADMIN has the highest rank', () => {
    expect(ROLE_HIERARCHY.SUPER_ADMIN).toBe(4);
  });

  it('roles are strictly ordered: VIEWER < MEMBER < MANAGER < ADMIN < SUPER_ADMIN', () => {
    expect(ROLE_HIERARCHY.VIEWER).toBeLessThan(ROLE_HIERARCHY.MEMBER);
    expect(ROLE_HIERARCHY.MEMBER).toBeLessThan(ROLE_HIERARCHY.MANAGER);
    expect(ROLE_HIERARCHY.MANAGER).toBeLessThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeLessThan(ROLE_HIERARCHY.SUPER_ADMIN);
  });
});

describe('hasMinimumRole', () => {
  // Each role passes its own minimum
  it('VIEWER passes VIEWER requirement', () => {
    expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true);
  });

  it('MEMBER passes MEMBER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'MEMBER')).toBe(true);
  });

  it('MANAGER passes MANAGER requirement', () => {
    expect(hasMinimumRole('MANAGER', 'MANAGER')).toBe(true);
  });

  it('ADMIN passes ADMIN requirement', () => {
    expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true);
  });

  it('SUPER_ADMIN passes SUPER_ADMIN requirement', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
  });

  // Higher roles pass lower requirements
  it('SUPER_ADMIN passes ADMIN requirement', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
  });

  it('ADMIN passes MANAGER requirement', () => {
    expect(hasMinimumRole('ADMIN', 'MANAGER')).toBe(true);
  });

  it('MANAGER passes MEMBER requirement', () => {
    expect(hasMinimumRole('MANAGER', 'MEMBER')).toBe(true);
  });

  it('MEMBER passes VIEWER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'VIEWER')).toBe(true);
  });

  // Lower roles fail higher requirements
  it('VIEWER fails MEMBER requirement', () => {
    expect(hasMinimumRole('VIEWER', 'MEMBER')).toBe(false);
  });

  it('MEMBER fails MANAGER requirement', () => {
    expect(hasMinimumRole('MEMBER', 'MANAGER')).toBe(false);
  });

  it('MANAGER fails ADMIN requirement', () => {
    expect(hasMinimumRole('MANAGER', 'ADMIN')).toBe(false);
  });

  it('ADMIN fails SUPER_ADMIN requirement', () => {
    expect(hasMinimumRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
  });

  it('VIEWER fails SUPER_ADMIN requirement', () => {
    expect(hasMinimumRole('VIEWER', 'SUPER_ADMIN')).toBe(false);
  });
});

describe('withRole middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when there is no role in the request context', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withRole('MEMBER')(handler);
    // Call WITHOUT runWithContext → getRequestContext() returns undefined
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when the user role is below the required minimum', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withRole('ADMIN')(handler);
    const res = await runWithContext(
      { requestId: 'req-1', userId: 'u1', organizationId: 'org-1', role: 'MEMBER' },
      () => wrapped(makeReq(), ctx),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls the handler when the user role exactly meets the minimum', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withRole('MANAGER')(handler);
    const res = await runWithContext(
      { requestId: 'req-2', userId: 'u1', organizationId: 'org-1', role: 'MANAGER' },
      () => wrapped(makeReq(), ctx),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('calls the handler when the user role exceeds the minimum', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withRole('MEMBER')(handler);
    const res = await runWithContext(
      { requestId: 'req-3', userId: 'u1', organizationId: 'org-1', role: 'SUPER_ADMIN' },
      () => wrapped(makeReq(), ctx),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes VIEWER with VIEWER requirement', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withRole('VIEWER')(handler);
    const res = await runWithContext(
      { requestId: 'req-4', userId: 'u1', organizationId: 'org-1', role: 'VIEWER' },
      () => wrapped(makeReq(), ctx),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
