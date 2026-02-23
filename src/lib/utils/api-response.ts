import { NextResponse } from 'next/server';

export interface ApiMeta {
  pagination?: { cursor?: string; hasMore: boolean; limit: number };
  timestamp: string;
}

export function apiSuccess<T>(
  data: T,
  meta: Omit<ApiMeta, 'timestamp'> = {},
  status = 200,
): NextResponse<{ data: T; meta: ApiMeta }> {
  return NextResponse.json(
    {
      data,
      meta: {
        ...meta,
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  requestId?: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: { code, message, ...(details !== undefined ? { details } : {}) },
      meta: {
        requestId: requestId ?? null,
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}
