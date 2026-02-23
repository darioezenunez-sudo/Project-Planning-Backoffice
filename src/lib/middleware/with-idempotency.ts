import { NextResponse } from 'next/server';

import { createIdempotencyRepository } from '@/modules/idempotency/idempotency.repository';
import { createIdempotencyService } from '@/modules/idempotency/idempotency.service';

import { handleError } from '../errors/error-handler';
import { getRequestContext } from '../request-context';

import type { RouteContext, RouteHandler } from './compose';

const idempotencyService = createIdempotencyService(createIdempotencyRepository());

/**
 * Idempotency guard for critical POST endpoints.
 *
 * Requires the `Idempotency-Key` request header (a client-generated UUID).
 * On the first request: processes normally and stores the result.
 * On replay: returns the stored result without re-executing.
 * If a request is in-flight: returns 409 Conflict.
 *
 * @param route - A stable string identifier for the endpoint, e.g. "POST /api/v1/sessions/:id/summary"
 *
 * @example
 * compose(withAuth, withTenant, withIdempotency('POST /sessions/:id/summary'))(handler)
 */
export function withIdempotency(route: string): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler) => {
    return async (req, context: RouteContext): Promise<NextResponse> => {
      const ctx = getRequestContext();
      const requestId = ctx?.requestId ?? crypto.randomUUID();

      const key = req.headers.get('idempotency-key');
      if (!key) {
        // No key provided — skip idempotency (not all POSTs require it).
        return handler(req, context);
      }

      try {
        const check = await idempotencyService.check(key, route);

        if (!check.ok) {
          return handleError(check.error, requestId);
        }

        if (check.value.status === 'completed') {
          // Replay stored response.
          return NextResponse.json(check.value.responseBody, {
            status: check.value.responseStatus,
            headers: { 'X-Idempotent-Replayed': 'true' },
          });
        }

        // 'new' — execute handler and store result.
        let response: NextResponse;
        try {
          response = await handler(req, context);
          const body: unknown = await response
            .clone()
            .json()
            .catch(() => null);
          await idempotencyService.complete(key, response.status, body);
        } catch (handlerErr) {
          await idempotencyService.fail(key);
          throw handlerErr;
        }

        return response;
      } catch (err) {
        return handleError(err, requestId);
      }
    };
  };
}
