import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

import { createDeviceRepository } from '@/modules/auth/device.repository';
import { createDeviceService } from '@/modules/auth/device.service';

import { getUserIdFromAuthCache, setAuthCache } from '../cache/auth-cache';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { handleError } from '../errors/error-handler';
import { logger } from '../logger';
import { generateRequestId, getRequestContext, runWithContext } from '../request-context';
import { isErr } from '../result';
import { createSupabaseServerClient } from '../supabase/server';

import type { Middleware, RouteContext, RouteHandler } from './compose';

let deviceServiceInstance: ReturnType<typeof createDeviceService> | null = null;

function getDeviceService() {
  if (!deviceServiceInstance) {
    deviceServiceInstance = createDeviceService(createDeviceRepository());
  }
  return deviceServiceInstance;
}

/**
 * Validates the Supabase JWT and injects userId into the request context.
 *
 * Strategy (two channels):
 * 1. Bearer token — used by Assistant/API clients (Electron app).
 * 2. Cookie session — used by browser clients after Supabase login.
 * 3. On failure → 401 UNAUTHORIZED.
 *
 * Must be composed BEFORE withTenant.
 */
export const withAuth: Middleware = (handler: RouteHandler) => {
  return async (req, context: RouteContext): Promise<NextResponse> => {
    const existingCtx = getRequestContext();
    const requestId = existingCtx?.requestId ?? generateRequestId();

    try {
      const userId = await resolveUserId(req, requestId);

      if (!userId) {
        logger.warn({ requestId }, 'withAuth: no valid session found');
        return handleError(
          new AppError(
            ErrorCode.UNAUTHORIZED,
            401,
            'Authentication required',
            undefined,
            undefined,
            requestId,
          ),
          requestId,
        );
      }

      return await runWithContext({ ...(existingCtx ?? {}), requestId, userId }, () =>
        handler(req, context),
      );
    } catch (err) {
      return handleError(err, requestId);
    }
  };
};

/** Tries Bearer token first, falls back to cookie session. Returns userId or undefined. */
async function resolveUserId(req: NextRequest, requestId: string): Promise<string | undefined> {
  const token = extractBearerToken(req);
  if (token) {
    return resolveFromBearer(token, requestId);
  }
  return resolveFromCookies(req);
}

async function resolveFromBearer(token: string, requestId: string): Promise<string | undefined> {
  if (token.startsWith('device_')) {
    const result = await getDeviceService().resolveToken(token);
    if (isErr(result)) {
      logger.warn({ requestId, reason: result.error.message }, 'withAuth: invalid device token');
      return undefined;
    }
    return result.value.userId;
  }

  const cached = await getUserIdFromAuthCache(token);
  if (cached) return cached;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error ?? !user) {
    logger.warn(
      { requestId, reason: error?.message ?? 'no user' },
      'withAuth: invalid bearer token',
    );
    return undefined;
  }

  await setAuthCache(token, user.id);
  return user.id;
}

async function resolveFromCookies(req: NextRequest): Promise<string | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-deprecated -- getAll/setAll is the non-deprecated API
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: () => {
        // Read-only in route handler context — session refresh handled by middleware.ts
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

/** Extracts the Bearer token from the Authorization header. */
function extractBearerToken(req: Request): string | undefined {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return undefined;
  return auth.slice(7);
}
