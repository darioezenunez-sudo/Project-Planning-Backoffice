import { describe, it, expect } from 'vitest';
import { apiSuccess, apiError } from '@/lib/utils/api-response';

describe('apiSuccess', () => {
  it('returns 200 by default with data and timestamp', async () => {
    const res = apiSuccess({ id: '1', name: 'Acme' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ id: '1', name: 'Acme' });
    expect(typeof body.meta.timestamp).toBe('string');
  });

  it('accepts a custom status code', async () => {
    const res = apiSuccess({ id: '2' }, {}, 201);
    expect(res.status).toBe(201);
  });

  it('includes pagination meta when provided', async () => {
    const res = apiSuccess([], { pagination: { hasMore: true, cursor: 'abc', limit: 20 } });
    const body = await res.json();
    expect(body.meta.pagination.hasMore).toBe(true);
    expect(body.meta.pagination.cursor).toBe('abc');
  });
});

describe('apiError', () => {
  it('returns correct status and error shape', async () => {
    const res = apiError('NOT_FOUND', 'Resource not found', 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Resource not found');
    expect(body.meta.requestId).toBeNull();
    expect(typeof body.meta.timestamp).toBe('string');
  });

  it('includes requestId when provided', async () => {
    const res = apiError('UNAUTHORIZED', 'Unauthorized', 401, 'req-123');
    const body = await res.json();
    expect(body.meta.requestId).toBe('req-123');
  });

  it('includes details when provided', async () => {
    const res = apiError('BAD_REQUEST', 'Validation failed', 400, undefined, { field: 'name' });
    const body = await res.json();
    expect(body.error.details).toEqual({ field: 'name' });
  });

  it('omits details when not provided', async () => {
    const res = apiError('BAD_REQUEST', 'Bad', 400);
    const body = await res.json();
    expect('details' in body.error).toBe(false);
  });
});
