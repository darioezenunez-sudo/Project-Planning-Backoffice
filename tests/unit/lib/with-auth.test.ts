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

// vi.hoisted ensures these fn refs are created before vi.mock factories run
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { withAuth } from '@/lib/middleware/with-auth';

const ctx = { params: Promise.resolve({}) };
const USER_ID = 'user-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeReq(bearer?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (bearer) headers['authorization'] = `Bearer ${bearer}`;
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('calls the handler when a valid bearer token resolves to a user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeReq('valid-token'), ctx);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    // Bearer token is forwarded to supabase.auth.getUser
    expect(mockGetUser).toHaveBeenCalledWith('valid-token');
  });

  it('returns 401 when the bearer token is rejected by Supabase', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeReq('bad-token'), ctx);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('falls back to cookie session when no Authorization header is present', async () => {
    // Cookie path: createServerClient is called, not createSupabaseServerClient
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeReq(/* no bearer */), ctx);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 401 when no bearer and cookie session has no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when env vars are absent and no bearer is provided', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    // createServerClient should NOT be called since env vars are missing
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const { createServerClient } = await import('@supabase/ssr');

    expect(vi.mocked(createServerClient)).not.toHaveBeenCalled();
  });
});
