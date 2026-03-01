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

// vi.hoisted so these refs are valid inside the vi.mock factory below
const mockCheck = vi.hoisted(() => vi.fn());
const mockComplete = vi.hoisted(() => vi.fn());
const mockFail = vi.hoisted(() => vi.fn());

vi.mock('@/modules/idempotency/idempotency.repository', () => ({
  createIdempotencyRepository: vi.fn(() => ({})),
}));

vi.mock('@/modules/idempotency/idempotency.service', () => ({
  createIdempotencyService: vi.fn(() => ({
    check: mockCheck,
    complete: mockComplete,
    fail: mockFail,
  })),
}));

// Dynamic import AFTER mocks so the module-level singleton uses the mocked service
const { withIdempotency } = await import('@/lib/middleware/with-idempotency');
const { AppError } = await import('@/lib/errors/app-error');
const { ErrorCode } = await import('@/lib/errors/error-codes');

const ROUTE = 'POST /api/v1/test';
const KEY = 'idem-key-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ctx = { params: Promise.resolve({}) };

function makeReq(idempotencyKey?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  return new NextRequest('http://localhost/api/test', { method: 'POST', headers });
}

describe('withIdempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through to the handler when no Idempotency-Key header is present', async () => {
    const handler = vi.fn(() => NextResponse.json({ created: true }, { status: 201 }));
    const wrapped = withIdempotency(ROUTE)(handler);
    const res = await wrapped(makeReq(/* no key */), ctx);
    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledOnce();
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it('replays the stored response for a completed key without calling the handler', async () => {
    mockCheck.mockResolvedValue({
      ok: true,
      value: { status: 'completed', responseBody: { id: 'abc' }, responseStatus: 201 },
    });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withIdempotency(ROUTE)(handler);
    const res = await wrapped(makeReq(KEY), ctx);
    expect(res.status).toBe(201);
    expect(res.headers.get('X-Idempotent-Replayed')).toBe('true');
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe('abc');
    expect(handler).not.toHaveBeenCalled();
  });

  it('executes the handler and stores the result for a new key', async () => {
    mockCheck.mockResolvedValue({ ok: true, value: { status: 'new' } });
    mockComplete.mockResolvedValue(undefined);
    const handler = vi.fn(() => NextResponse.json({ created: true }, { status: 201 }));
    const wrapped = withIdempotency(ROUTE)(handler);
    const res = await wrapped(makeReq(KEY), ctx);
    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledOnce();
    expect(mockComplete).toHaveBeenCalledWith(KEY, 201, { created: true });
    expect(mockFail).not.toHaveBeenCalled();
  });

  it('returns the error response when the check returns an error result', async () => {
    mockCheck.mockResolvedValue({
      ok: false,
      error: new AppError(ErrorCode.CONFLICT, 409, 'Request already in progress'),
    });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = withIdempotency(ROUTE)(handler);
    const res = await wrapped(makeReq(KEY), ctx);
    expect(res.status).toBe(409);
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls fail() and rethrows when the handler throws', async () => {
    mockCheck.mockResolvedValue({ ok: true, value: { status: 'new' } });
    mockFail.mockResolvedValue(undefined);
    const handler = vi.fn(() => {
      throw new Error('handler crashed');
    });
    const wrapped = withIdempotency(ROUTE)(handler);
    // The outer catch in withIdempotency returns handleError (500)
    const res = await wrapped(makeReq(KEY), ctx);
    expect(res.status).toBe(500);
    expect(mockFail).toHaveBeenCalledWith(KEY);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
