import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { apiError } from '../utils/api-response';

import type { RouteContext, RouteHandler } from './compose';

type SchemaMap = {
  body?: z.ZodType;
  query?: z.ZodType;
};

/**
 * Validates request body and query params against Zod schemas.
 * Parsed results are available via getValidated(req) in the handler.
 * @stub Fase 1: extender con params validation y error details.
 */
export function withValidation(schemas: SchemaMap): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler) => {
    return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
      if (schemas.body) {
        try {
          const raw: unknown = await req.json();
          schemas.body.parse(raw);
        } catch {
          return apiError('BAD_REQUEST', 'Invalid request body', 400);
        }
      }
      if (schemas.query) {
        const url = new URL(req.url);
        const query = Object.fromEntries(url.searchParams.entries());
        try {
          schemas.query.parse(query);
        } catch {
          return apiError('BAD_REQUEST', 'Invalid query params', 400);
        }
      }
      return handler(req, context);
    };
  };
}
