import { z } from 'zod';

/**
 * Re-exports y helpers de validación.
 * Los shapes de entidades viven en src/schemas/ (ver ENGINEERING_STANDARDS §2).
 */
export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
