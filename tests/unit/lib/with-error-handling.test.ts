import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

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

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';

const ctx = { params: Promise.resolve({}) };

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/test');
}

describe('withErrorHandling', () => {
  it('passes the request to the handler and returns its response', async () => {
    const handler = vi.fn(() => NextResponse.json({ data: 'ok' }, { status: 200 }));
    const wrapped = withErrorHandling(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 500 when the handler throws a plain Error', async () => {
    const handler = vi.fn(() => {
      throw new Error('unexpected crash');
    });
    const wrapped = withErrorHandling(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns the AppError httpStatus when the handler throws an AppError', async () => {
    const handler = vi.fn(() => {
      throw new AppError(ErrorCode.NOT_FOUND, 404, 'Resource not found');
    });
    const wrapped = withErrorHandling(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when the handler throws a CONFLICT AppError', async () => {
    const handler = vi.fn(() => {
      throw new AppError(ErrorCode.CONFLICT, 409, 'Version conflict');
    });
    const wrapped = withErrorHandling(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(409);
  });

  it('handler response is passed through unmodified on success', async () => {
    const handler = vi.fn(() => NextResponse.json({ items: [1, 2, 3] }, { status: 201 }));
    const wrapped = withErrorHandling(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { items: number[] };
    expect(body.items).toHaveLength(3);
  });
});
