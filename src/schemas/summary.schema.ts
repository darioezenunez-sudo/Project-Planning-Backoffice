import { z } from 'zod';

import { paginationQuerySchema } from '@/schemas/shared.schema';

export const summaryStateEnum = z.enum(['DRAFT', 'REVIEW', 'EDITED', 'VALIDATED']);
export type SummaryState = z.infer<typeof summaryStateEnum>;

export const summaryEventEnum = z.enum(['SUBMIT', 'REQUEST_EDIT', 'VALIDATE']);
export type SummaryEvent = z.infer<typeof summaryEventEnum>;

export const createSummarySchema = z.object({
  rawContent: z.string().max(50000).optional(),
});
export type CreateSummaryInput = z.infer<typeof createSummarySchema>;

export const updateSummarySchema = z.object({
  rawContent: z.string().max(50000).optional(),
  editedContent: z.string().max(50000).optional(),
  version: z.number().int().min(1),
});
export type UpdateSummaryInput = z.infer<typeof updateSummarySchema>;

export const transitionSummarySchema = z.object({
  event: summaryEventEnum,
  version: z.number().int().min(1),
});
export type TransitionSummaryInput = z.infer<typeof transitionSummarySchema>;

export const listSummariesQuerySchema = paginationQuerySchema;
export type ListSummariesQuery = z.infer<typeof listSummariesQuerySchema>;
