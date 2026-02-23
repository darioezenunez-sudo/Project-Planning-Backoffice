export interface PaginationParams {
  cursor?: string;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedMeta {
  nextCursor?: string;
  hasMore: boolean;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePaginationParams(
  searchParams: URLSearchParams | Record<string, string | undefined>,
): { cursor?: string; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' } {
  const params =
    searchParams instanceof URLSearchParams
      ? Object.fromEntries(searchParams.entries())
      : searchParams;
  const limitRaw = params.limit ?? params.pageSize;
  let limit = Number(limitRaw);
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  const sortBy = params.sortBy ?? 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
  return {
    cursor: params.cursor,
    limit,
    sortBy,
    sortOrder,
  };
}

/**
 * Encodes an id as a base64 cursor string.
 * Keeps cursors opaque to API consumers.
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64url');
}

/**
 * Decodes a base64 cursor back to an id string.
 * Returns null if the cursor is missing or invalid.
 */
export function decodeCursor(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Extracts limit and decoded cursor from a query object compatible with
 * `paginationQuerySchema` from `@/schemas/shared.schema`.
 */
export function buildCursorPagination(query: { cursor?: string; limit?: number }): {
  cursor: string | null;
  limit: number;
} {
  return {
    cursor: decodeCursor(query.cursor),
    limit: query.limit ?? DEFAULT_LIMIT,
  };
}

export function buildPaginatedResponse<T extends { id: string }>(
  items: T[],
  params: { limit: number },
): PaginatedResponse<T> {
  const hasMore = items.length > params.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]?.id : undefined;
  return {
    data,
    meta: {
      nextCursor,
      hasMore,
      limit: params.limit,
    },
  };
}
