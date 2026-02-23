import { z } from 'zod';

// ─── Primitives ────────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().datetime({ offset: true });

// ─── Pagination ────────────────────────────────────────────────────────────────

/** Cursor-based pagination query params. */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Pagination meta included in list responses. */
export const paginationMetaSchema = z.object({
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number().int(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// ─── Soft-Delete / Versioning ──────────────────────────────────────────────────

/** Standard columns present on all mutable entities. */
export const standardColumnsSchema = z.object({
  id: uuidSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  version: z.number().int(),
});

// ─── Filter helpers ────────────────────────────────────────────────────────────

/** Common list query params shared across all entity list endpoints. */
export const listQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
