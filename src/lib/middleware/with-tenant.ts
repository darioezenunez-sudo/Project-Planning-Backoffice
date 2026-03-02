import type { Role } from '@prisma/client';
import type { NextResponse } from 'next/server';

import { getTenantMemberFromCache, setTenantMemberCache } from '../cache/tenant-cache';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { handleError } from '../errors/error-handler';
import { logger } from '../logger';
import { prisma } from '../prisma';
import { getRequestContext, runWithContext } from '../request-context';

import type { Middleware, RouteContext, RouteHandler } from './compose';

/**
 * Extracts organizationId from the X-Organization-Id request header, verifies
 * that the authenticated user is an active member, and injects organizationId
 * and role into the request context.
 *
 * Must be composed AFTER withAuth (requires userId in context).
 */
export const withTenant: Middleware = (handler: RouteHandler) => {
  return async (req, context: RouteContext): Promise<NextResponse> => {
    const ctx = getRequestContext();
    const requestId = ctx?.requestId ?? crypto.randomUUID();

    if (!ctx?.userId) {
      const appError = new AppError(
        ErrorCode.UNAUTHORIZED,
        401,
        'withTenant requires withAuth to run first',
        undefined,
        undefined,
        requestId,
      );
      return handleError(appError, requestId);
    }

    const organizationId = req.headers.get('x-organization-id');
    if (!organizationId) {
      const appError = new AppError(
        ErrorCode.BAD_REQUEST,
        400,
        'Missing X-Organization-Id header',
        undefined,
        undefined,
        requestId,
      );
      return handleError(appError, requestId);
    }

    try {
      const cached = await getTenantMemberFromCache(ctx.userId, organizationId);
      if (cached) {
        return await runWithContext({ ...ctx, organizationId, role: cached.role as Role }, () =>
          handler(req, context),
        );
      }

      const member = await prisma.organizationMember.findFirst({
        where: { organizationId, userId: ctx.userId },
        select: { role: true },
      });

      if (!member) {
        logger.warn(
          { requestId, userId: ctx.userId, organizationId },
          'withTenant: user not a member',
        );
        const appError = new AppError(
          ErrorCode.FORBIDDEN,
          403,
          'You are not a member of this organization',
          undefined,
          undefined,
          requestId,
        );
        return handleError(appError, requestId);
      }

      await setTenantMemberCache(ctx.userId, organizationId, member.role);

      return await runWithContext({ ...ctx, organizationId, role: member.role }, () =>
        handler(req, context),
      );
    } catch (err) {
      return handleError(err, requestId);
    }
  };
};
