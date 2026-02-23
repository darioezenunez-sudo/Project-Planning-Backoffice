import type { Role } from '@prisma/client';
import type { NextResponse } from 'next/server';

import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { handleError } from '../errors/error-handler';
import { logger } from '../logger';
import { getRequestContext } from '../request-context';

import type { RouteContext, RouteHandler } from './compose';

/**
 * Role hierarchy: higher index = more permissions.
 * Used to compare roles numerically.
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

/**
 * Returns true if the user's role meets or exceeds the minimum required role.
 */
export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * RBAC guard middleware. Verifies the user's role within the current organization
 * meets the specified minimum role.
 *
 * Must be composed AFTER withAuth and withTenant (requires role in context).
 *
 * @example
 * compose(withAuth, withTenant, withRole('ADMIN'), withValidation(schema))(handler)
 */
export function withRole(minimumRole: Role): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler) => {
    return async (req, context: RouteContext): Promise<NextResponse> => {
      const ctx = getRequestContext();
      const requestId = ctx?.requestId ?? crypto.randomUUID();

      if (!ctx?.role) {
        const appError = new AppError(
          ErrorCode.UNAUTHORIZED,
          401,
          'withRole requires withAuth and withTenant to run first',
          undefined,
          undefined,
          requestId,
        );
        return handleError(appError, requestId);
      }

      if (!hasMinimumRole(ctx.role, minimumRole)) {
        logger.warn(
          {
            requestId,
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            userRole: ctx.role,
            requiredRole: minimumRole,
          },
          'withRole: insufficient permissions',
        );
        const appError = new AppError(
          ErrorCode.FORBIDDEN,
          403,
          `Requires ${minimumRole} role or higher`,
          undefined,
          undefined,
          requestId,
        );
        return handleError(appError, requestId);
      }

      return handler(req, context);
    };
  };
}
