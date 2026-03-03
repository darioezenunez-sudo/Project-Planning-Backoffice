import { z } from 'zod';

import { paginationQuerySchema } from '@/schemas/shared.schema';

// ─── Echelon ───────────────────────────────────────────────────────────────────

export const echelonStateEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'CLOSING',
  'CLOSURE_REVIEW',
  'CLOSED',
]);
export type EchelonState = z.infer<typeof echelonStateEnum>;

export const echelonEventEnum = z.enum([
  'START_SESSION',
  'CONSOLIDATE',
  'CONSOLIDATION_COMPLETE',
  'CLOSE',
  'REJECT', // CLOSURE_REVIEW → IN_PROGRESS (rechazar cierre)
]);
export type EchelonEvent = z.infer<typeof echelonEventEnum>;

export const createEchelonSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(2).max(200),
  configBlueprint: z.record(z.unknown()).optional(),
});
export type CreateEchelonInput = z.infer<typeof createEchelonSchema>;

export const updateEchelonSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  configBlueprint: z.record(z.unknown()).optional(),
  /** F2: when in CLOSURE_REVIEW, allow updating the consolidated report (edited version). */
  consolidatedReport: z.record(z.unknown()).optional(),
  version: z.number().int().min(1),
});
export type UpdateEchelonInput = z.infer<typeof updateEchelonSchema>;

export const transitionEchelonSchema = z.object({
  event: echelonEventEnum,
  version: z.number().int().min(1),
});
export type TransitionEchelonInput = z.infer<typeof transitionEchelonSchema>;

export const listEchelonsQuerySchema = paginationQuerySchema.extend({
  productId: z.string().uuid().optional(),
  state: echelonStateEnum.optional(),
});
export type ListEchelonsQuery = z.infer<typeof listEchelonsQuerySchema>;

// ─── RequiredField ─────────────────────────────────────────────────────────────

export const createRequiredFieldSchema = z.object({
  label: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateRequiredFieldInput = z.infer<typeof createRequiredFieldSchema>;

export const updateRequiredFieldSchema = z.object({
  label: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional(),
  isMet: z.boolean().optional(),
  metByUserId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  version: z.number().int().min(1),
});
export type UpdateRequiredFieldInput = z.infer<typeof updateRequiredFieldSchema>;

// ─── DecisionLink ──────────────────────────────────────────────────────────────

export const createDecisionLinkSchema = z.object({
  requiredFieldId: z.string().uuid().optional(),
  executiveSummaryId: z.string().uuid().optional(),
  label: z.string().min(2).max(200),
  linkUrl: z.string().url().optional(),
  linkType: z.string().max(50).optional(),
});
export type CreateDecisionLinkInput = z.infer<typeof createDecisionLinkSchema>;

export const updateDecisionLinkSchema = z.object({
  label: z.string().min(2).max(200).optional(),
  linkUrl: z.string().url().optional(),
  linkType: z.string().max(50).optional(),
  version: z.number().int().min(1),
});
export type UpdateDecisionLinkInput = z.infer<typeof updateDecisionLinkSchema>;
