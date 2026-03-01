import type { NextRequest, NextResponse } from 'next/server';

import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { handleError } from '../errors/error-handler';
import { logger } from '../logger';

import type { RouteContext, RouteHandler } from './compose';

// ─── In-memory sliding window store ────────────────────────────────────────────
// Module-level: persists for the lifetime of the process.
// For multi-instance / edge deployments wire this to Vercel KV once B5 is done.
const store = new Map<string, number[]>();

/** Parse a window string like "30s", "5m", "1h" into milliseconds. */
function parseWindowMs(window: string): number {
  const m = /^(\d+)(s|m|h)$/.exec(window);
  if (!m) return 60_000; // default: 1 minute
  const value = parseInt(m[1] ?? '0', 10);
  const unit = m[2] ?? 's';
  if (unit === 'm') return value * 60_000;
  if (unit === 'h') return value * 3_600_000;
  return value * 1_000; // 's'
}

/** Derive a per-client key from the request's IP address. */
function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'anonymous';
  return `rl:${ip}`;
}

/**
 * Sliding-window rate limiter middleware.
 *
 * Uses an in-memory Map as the backing store (suitable for single-instance deployments).
 * When Vercel KV is configured (B5), this can be swapped for a distributed adapter.
 *
 * @example
 * export const POST = compose(withErrorHandling, withRateLimit({ limit: 20, window: '1m' }), withAuth)(handler)
 */
export function withRateLimit(config: {
  limit: number;
  window: string;
}): (handler: RouteHandler) => RouteHandler {
  const windowMs = parseWindowMs(config.window);

  return (handler: RouteHandler) => {
    return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
      const key = getClientKey(req);
      const now = Date.now();
      const cutoff = now - windowMs;

      // Retain only timestamps within the current window, then add this request.
      const previous = store.get(key) ?? [];
      const recent = previous.filter((t) => t > cutoff);
      recent.push(now);
      store.set(key, recent);

      if (recent.length > config.limit) {
        logger.warn(
          { key, count: recent.length, limit: config.limit, window: config.window },
          'Rate limit exceeded',
        );
        return handleError(
          new AppError(ErrorCode.RATE_LIMITED, 429, 'Too many requests. Please slow down.'),
        );
      }

      return await handler(req, context);
    };
  };
}
