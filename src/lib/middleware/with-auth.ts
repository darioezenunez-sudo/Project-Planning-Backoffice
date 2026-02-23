import type { NextResponse } from 'next/server';

import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { handleError } from '../errors/error-handler';
import { logger } from '../logger';
import { generateRequestId, getRequestContext, runWithContext } from '../request-context';
import { createSupabaseServerClient } from '../supabase/server';

import type { Middleware, RouteContext, RouteHandler } from './compose';

/**
 * Validates the Supabase JWT and injects userId into the request context.
 *
 * Strategy:
 * 1. Use Supabase `auth.getUser()` which validates the JWT against Supabase's
 *    public key — no local secret needed.
 * 2. The token is passed as a Bearer header (used by Assistant/API clients).
 * 3. On failure → 401 UNAUTHORIZED.
 *
 * Must be composed BEFORE withTenant.
 */
export const withAuth: Middleware = (handler: RouteHandler) => {
  return async (req, context: RouteContext): Promise<NextResponse> => {
    const existingCtx = getRequestContext();
    const requestId = existingCtx?.requestId ?? generateRequestId();

    try {
      const token = extractBearerToken(req);
      if (!token) {
        const appError = new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          'Missing Authorization header',
          undefined,
          undefined,
          requestId,
        );
        return handleError(appError, requestId);
      }

      const supabase = createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error ?? !user) {
        logger.warn({ requestId, reason: error?.message ?? 'no user' }, 'withAuth: unauthorized');
        const appError = new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          'Invalid or expired token',
          undefined,
          undefined,
          requestId,
        );
        return handleError(appError, requestId);
      }

      // Inject userId into context (organizationId/role added later by withTenant).
      return await runWithContext({ ...(existingCtx ?? {}), requestId, userId: user.id }, () =>
        handler(req, context),
      );
    } catch (err) {
      return handleError(err, requestId);
    }
  };
};

/** Extracts the Bearer token from the Authorization header. */
function extractBearerToken(req: Request): string | undefined {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return undefined;
  return auth.slice(7);
}
