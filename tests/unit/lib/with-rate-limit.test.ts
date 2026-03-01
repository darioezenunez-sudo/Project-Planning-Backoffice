import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withRateLimit } from '@/lib/middleware/with-rate-limit';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Suppress pino output from error-handler (imported transitively)
vi.mock('pino', () => ({
  default: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

const okHandler = vi.fn(() => NextResponse.json({ ok: true }));

/** Create a NextRequest with a specific X-Forwarded-For header (used as client key). */
function makeRequest(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through when request count is within the limit', async () => {
    const wrapped = withRateLimit({ limit: 5, window: '1m' })(okHandler);
    const res = await wrapped(makeRequest('10.1.0.1'), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledOnce();
  });

  it('returns 429 RATE_LIMITED when the limit is exceeded', async () => {
    const wrapped = withRateLimit({ limit: 2, window: '1m' })(okHandler);
    const ctx = { params: Promise.resolve({}) };
    const ip = '10.1.0.2';

    // 2 requests allowed; 3rd should be blocked
    await wrapped(makeRequest(ip), ctx);
    await wrapped(makeRequest(ip), ctx);
    const res = await wrapped(makeRequest(ip), ctx);

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('resets the count after the window expires', async () => {
    const wrapped = withRateLimit({ limit: 1, window: '10s' })(okHandler);
    const ctx = { params: Promise.resolve({}) };
    const ip = '10.1.0.3';

    // First request: OK
    const first = await wrapped(makeRequest(ip), ctx);
    expect(first.status).toBe(200);

    // Second request within window: blocked
    const blocked = await wrapped(makeRequest(ip), ctx);
    expect(blocked.status).toBe(429);

    // Advance past the 10s window
    vi.advanceTimersByTime(11_000);

    // Third request (new window): OK again
    const allowed = await wrapped(makeRequest(ip), ctx);
    expect(allowed.status).toBe(200);
  });

  it('tracks clients independently by IP', async () => {
    const wrapped = withRateLimit({ limit: 1, window: '1m' })(okHandler);
    const ctx = { params: Promise.resolve({}) };

    // ip A hits limit
    await wrapped(makeRequest('10.1.1.1'), ctx);
    const blockedA = await wrapped(makeRequest('10.1.1.1'), ctx);
    expect(blockedA.status).toBe(429);

    // ip B is unaffected
    const allowedB = await wrapped(makeRequest('10.1.1.2'), ctx);
    expect(allowedB.status).toBe(200);
  });

  describe('parseWindowMs (via integration)', () => {
    it('respects seconds window ("5s")', async () => {
      const wrapped = withRateLimit({ limit: 1, window: '5s' })(okHandler);
      const ctx = { params: Promise.resolve({}) };
      const ip = '10.1.2.1';

      await wrapped(makeRequest(ip), ctx);
      const blocked = await wrapped(makeRequest(ip), ctx);
      expect(blocked.status).toBe(429);

      vi.advanceTimersByTime(6_000); // past 5s window
      const allowed = await wrapped(makeRequest(ip), ctx);
      expect(allowed.status).toBe(200);
    });

    it('respects hours window ("1h")', async () => {
      const wrapped = withRateLimit({ limit: 1, window: '1h' })(okHandler);
      const ctx = { params: Promise.resolve({}) };
      const ip = '10.1.2.2';

      // Hit the limit (no intermediate requests so no extra timestamps accumulate)
      await wrapped(makeRequest(ip), ctx);
      const blocked = await wrapped(makeRequest(ip), ctx);
      expect(blocked.status).toBe(429);

      // Advance past the full 1-hour window in one step
      vi.advanceTimersByTime(61 * 60 * 1000);
      const allowed = await wrapped(makeRequest(ip), ctx);
      expect(allowed.status).toBe(200);
    });
  });
});
