import type { NextRequest, NextResponse } from 'next/server';
import type { z, ZodError } from 'zod';

import { apiError } from '../utils/api-response';

import type { RouteContext, RouteHandler } from './compose';

/** Context extended by withValidation; use in handlers that use withValidation. */
export type RouteContextWithValidated = RouteContext & { validated: ValidatedContext };

const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
const HTTP_UNPROCESSABLE = 422;

type SchemaMap = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

export type ValidatedContext = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

function formatZodDetails(
  error: ZodError,
): Array<{ field: string; message: string; code: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
    code: issue.code,
  }));
}

function handleParse<T>(result: z.SafeParseReturnType<unknown, T>):
  | { ok: true; data: T }
  | {
      ok: false;
      details: Array<{ field: string; message: string; code: string }>;
      message: string;
    } {
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    details: formatZodDetails(result.error),
    message: result.error.message,
  };
}

/**
 * Validates request body, query and URL params against Zod schemas.
 * Parsed results are attached to context.validated for the handler.
 * Returns 422 with Zod error details on validation failure.
 */
export function withValidation(schemas: SchemaMap): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler) => {
    return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
      const validated: ValidatedContext = {};

      if (schemas.body) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          return apiError(
            VALIDATION_ERROR_CODE,
            'Invalid request body',
            HTTP_UNPROCESSABLE,
            undefined,
            [{ field: 'body', message: 'Invalid JSON', code: 'invalid_string' }],
          );
        }
        const result = schemas.body.safeParse(raw);
        const parsed = handleParse(result);
        if (!parsed.ok) {
          return apiError(
            VALIDATION_ERROR_CODE,
            parsed.message,
            HTTP_UNPROCESSABLE,
            undefined,
            parsed.details,
          );
        }
        validated.body = parsed.data;
      }

      if (schemas.query) {
        const url = new URL(req.url);
        const query = Object.fromEntries(url.searchParams.entries());
        const result = schemas.query.safeParse(query);
        const parsed = handleParse(result);
        if (!parsed.ok) {
          return apiError(
            VALIDATION_ERROR_CODE,
            parsed.message,
            HTTP_UNPROCESSABLE,
            undefined,
            parsed.details,
          );
        }
        validated.query = parsed.data;
      }

      if (schemas.params) {
        const raw = await context.params;
        const result = schemas.params.safeParse(raw);
        const parsed = handleParse(result);
        if (!parsed.ok) {
          return apiError(
            VALIDATION_ERROR_CODE,
            parsed.message,
            HTTP_UNPROCESSABLE,
            undefined,
            parsed.details,
          );
        }
        validated.params = parsed.data;
      }

      const contextWithValidated = { ...context, validated };
      return handler(req, contextWithValidated);
    };
  };
}
