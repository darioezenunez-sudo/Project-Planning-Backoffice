import { z } from 'zod';

import { uuidSchema } from '@/schemas/shared.schema';

// ─── POST /usage (Assistant reports LLM usage) ──────────────────────────────────

/** ISO month string e.g. "2026-02". */
export const monthYearSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM');

/** Input for recording usage (idempotent). */
export const recordUsageSchema = z.object({
  productId: uuidSchema.optional().nullable(),
  echelonId: uuidSchema.optional().nullable(),
  monthYear: monthYearSchema,
  tokens: z.number().int().min(0),
  costCents: z.number().int().min(0).default(0),
});
export type RecordUsageInput = z.infer<typeof recordUsageSchema>;

/** Usage record as returned by API. */
export const usageRecordResponseSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  productId: uuidSchema.nullable(),
  echelonId: uuidSchema.nullable(),
  monthYear: z.string(),
  tokens: z.number().int(),
  costCents: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type UsageRecordResponse = z.infer<typeof usageRecordResponseSchema>;
