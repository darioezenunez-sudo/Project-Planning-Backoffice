import type { NextRequest, NextResponse } from 'next/server';

import { handleError } from '../errors';
import { generateRequestId, runWithContext } from '../request-context';

import type { Middleware, RouteContext, RouteHandler } from './compose';

export const withErrorHandling: Middleware = (handler: RouteHandler) => {
  return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const requestId = generateRequestId();
    try {
      return await runWithContext({ requestId, userId: undefined, organizationId: undefined }, () =>
        handler(req, context),
      );
    } catch (error) {
      return handleError(error, requestId);
    }
  };
};
