import type { NextRequest, NextResponse } from 'next/server';

import type { RouteContext, RouteHandler } from './compose';

/** Stub: en Fase 0 no hay Upstash; en Fase 1+ se implementa con @upstash/ratelimit. */
export function withRateLimit(_config: {
  limit: number;
  window: string;
}): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler) => {
    return async (req: NextRequest, context: RouteContext): Promise<NextResponse> =>
      handler(req, context);
  };
}
