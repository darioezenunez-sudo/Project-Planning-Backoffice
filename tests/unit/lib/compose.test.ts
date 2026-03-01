import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { compose } from '@/lib/middleware/compose';
import type { Middleware, RouteContext } from '@/lib/middleware/compose';

const ctx: RouteContext = { params: Promise.resolve({}) };

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/test');
}

describe('compose', () => {
  it('returns the handler unchanged when no middlewares are provided', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const wrapped = compose()(handler);
    const res = await wrapped(makeReq(), ctx);
    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('wraps the handler with a single middleware', async () => {
    const order: string[] = [];
    const mw: Middleware = (h) => async (req, c) => {
      order.push('mw');
      return h(req, c);
    };
    const handler = vi.fn(() => {
      order.push('handler');
      return NextResponse.json({ ok: true });
    });
    await compose(mw)(handler)(makeReq(), ctx);
    expect(order).toEqual(['mw', 'handler']);
  });

  it('applies multiple middlewares left-to-right (outermost first)', async () => {
    const order: string[] = [];
    const mw1: Middleware = (h) => async (req, c) => {
      order.push('mw1');
      return h(req, c);
    };
    const mw2: Middleware = (h) => async (req, c) => {
      order.push('mw2');
      return h(req, c);
    };
    const mw3: Middleware = (h) => async (req, c) => {
      order.push('mw3');
      return h(req, c);
    };
    const handler = vi.fn(() => {
      order.push('handler');
      return NextResponse.json({ ok: true });
    });

    await compose(mw1, mw2, mw3)(handler)(makeReq(), ctx);
    expect(order).toEqual(['mw1', 'mw2', 'mw3', 'handler']);
  });

  it('short-circuits when a middleware returns without calling the handler', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const blocker: Middleware = () => async () =>
      NextResponse.json({ blocked: true }, { status: 403 });
    const handler = vi.fn(() => NextResponse.json({ ok: true }));

    const res = await compose(blocker)(handler)(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('propagates the response from the inner handler through all middleware layers', async () => {
    const passthrough: Middleware = (h) => async (req, c) => h(req, c);
    const handler = vi.fn(() => NextResponse.json({ value: 42 }, { status: 201 }));

    const res = await compose(passthrough, passthrough)(handler)(makeReq(), ctx);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { value: number };
    expect(body.value).toBe(42);
  });
});
