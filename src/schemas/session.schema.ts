import { z } from 'zod';

import { paginationQuerySchema } from '@/schemas/shared.schema';

export const createSessionSchema = z.object({
  conductedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z.object({
  conductedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(1),
});
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const listSessionsQuerySchema = paginationQuerySchema;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
