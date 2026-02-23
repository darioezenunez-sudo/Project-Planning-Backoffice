import type { NextRequest, NextResponse } from 'next/server';

// Next.js 15: dynamic route params are always a Promise<Record<...>>
export type RouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

export type RouteHandler = (
  req: NextRequest,
  context: RouteContext,
) => Promise<NextResponse> | NextResponse;

export type Middleware = (handler: RouteHandler) => RouteHandler;

export function compose(...middlewares: Middleware[]): (handler: RouteHandler) => RouteHandler {
  return (handler) => middlewares.reduceRight<RouteHandler>((acc, mw) => mw(acc), handler);
}
