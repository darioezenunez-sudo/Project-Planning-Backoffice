import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';

// Mock logger to avoid pino/AsyncLocalStorage side effects in unit tests
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

// Import after mock is registered
const { handleError } = await import('@/lib/errors/error-handler');

describe('handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps AppError to correct HTTP status and code', async () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 404, 'Company not found');
    const res = handleError(error, 'req-abc');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Company not found');
    expect(body.meta.requestId).toBe('req-abc');
  });

  it('maps unknown error to 500 INTERNAL_ERROR', async () => {
    const res = handleError(new Error('something broke'), 'req-xyz');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.meta.requestId).toBe('req-xyz');
  });

  it('handles non-Error values as unknown errors', async () => {
    const res = handleError('string error', undefined);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.meta.requestId).toBeNull();
  });

  it('uses AppError requestId over passed requestId', async () => {
    const error = new AppError(ErrorCode.UNAUTHORIZED, 401, 'No auth', undefined, undefined, 'from-error');
    const res = handleError(error, 'from-handler');
    const body = await res.json();
    expect(body.meta.requestId).toBe('from-error');
  });
});
