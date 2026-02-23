import { NextResponse } from 'next/server';

import { logger } from '../logger';

import { AppError } from './app-error';

const isProd = process.env.NODE_ENV === 'production';

export function handleError(error: unknown, requestId?: string): NextResponse {
  if (error instanceof AppError) {
    logger.warn(
      {
        error: { code: error.code, message: error.message },
        requestId: error.requestId ?? requestId,
      },
      'AppError: %s',
      error.message,
    );
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(isProd ? {} : { details: error.context }),
        },
        meta: {
          requestId: error.requestId ?? requestId ?? null,
          timestamp: new Date().toISOString(),
        },
      },
      { status: error.httpStatus },
    );
  }

  logger.error({ err: error, requestId }, 'Unhandled error');
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: isProd ? 'Internal server error' : String(error),
        ...(isProd ? {} : { details: error instanceof Error ? error.stack : undefined }),
      },
      meta: { requestId: requestId ?? null, timestamp: new Date().toISOString() },
    },
    { status: 500 },
  );
}
