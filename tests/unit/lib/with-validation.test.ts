import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { withValidation } from '@/lib/middleware/with-validation';

const bodySchema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive().optional(),
});
const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
const paramsSchema = z.object({ id: z.string().uuid() });

describe('withValidation', () => {
  it('passes through when body is valid and attaches parsed body to context', async () => {
    const handler = vi.fn(
      (
        _req: NextRequest,
        context: {
          params: Promise<Record<string, string | string[]>>;
          validated?: { body?: unknown };
        },
      ) => {
        expect(context.validated?.body).toEqual({ name: 'test', count: 5 });
        return NextResponse.json({ ok: true });
      },
    );
    const wrapped = withValidation({ body: bodySchema })(handler);
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'test', count: 5 }),
    });
    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 422 with field details when body is invalid', async () => {
    const handler = vi.fn();
    const wrapped = withValidation({ body: bodySchema })(handler);
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });
    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(json.error.details)).toBe(true);
    expect(json.error.details.some((d: { field: string }) => d.field === 'name')).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 422 when query is invalid', async () => {
    const handler = vi.fn();
    const wrapped = withValidation({ query: querySchema })(handler);
    const req = new NextRequest('http://localhost/api?limit=999');
    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes when query is valid and attaches parsed query to context', async () => {
    const handler = vi.fn(
      (
        _req: NextRequest,
        context: {
          params: Promise<Record<string, string | string[]>>;
          validated?: { query?: unknown };
        },
      ) => {
        expect(context.validated?.query).toEqual({ limit: 10 });
        return NextResponse.json({ ok: true });
      },
    );
    const wrapped = withValidation({ query: querySchema })(handler);
    const req = new NextRequest('http://localhost/api?limit=10');
    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 422 when params are invalid', async () => {
    const handler = vi.fn();
    const wrapped = withValidation({ params: paramsSchema })(handler);
    const req = new NextRequest('http://localhost/api/echelons/not-a-uuid');
    const res = await wrapped(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes when params are valid and attaches parsed params to context', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const handler = vi.fn(
      (
        _req: NextRequest,
        context: {
          params: Promise<Record<string, string | string[]>>;
          validated?: { params?: unknown };
        },
      ) => {
        expect(context.validated?.params).toEqual({ id: uuid });
        return NextResponse.json({ ok: true });
      },
    );
    const wrapped = withValidation({ params: paramsSchema })(handler);
    const req = new NextRequest(`http://localhost/api/echelons/${uuid}`);
    const res = await wrapped(req, { params: Promise.resolve({ id: uuid }) });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 422 with details when body is invalid JSON', async () => {
    const handler = vi.fn();
    const wrapped = withValidation({ body: bodySchema })(handler);
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: 'not json',
    });
    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.details).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });
});
