import { z } from 'zod';

import { paginationQuerySchema, standardColumnsSchema, uuidSchema } from './shared.schema';

// ─── Entity ────────────────────────────────────────────────────────────────────

export const attachmentBaseSchema = standardColumnsSchema.extend({
  organizationId: uuidSchema,
  executiveSummaryId: uuidSchema.nullable(),
  echelonId: uuidSchema.nullable(),
  filename: z.string().min(1).max(500),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1).max(255),
  fileSize: z.number().int().nonnegative(),
  uploadedByUserId: z.string().uuid().nullable(),
});

export type AttachmentBase = z.infer<typeof attachmentBaseSchema>;

// ─── Mutations ──────────────────────────────────────────────────────────────────

export const createAttachmentSchema = z.object({
  filename: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  fileSize: z.number().int().nonnegative(),
  executiveSummaryId: uuidSchema.optional(),
  echelonId: uuidSchema.optional(),
  /** Base64-encoded file content for upload. */
  content: z.string().optional(),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

/** Metadata only (no content); used by repository create. */
export type CreateAttachmentMetadataInput = Omit<CreateAttachmentInput, 'content'>;

// ─── Response ───────────────────────────────────────────────────────────────────

export const attachmentResponseSchema = attachmentBaseSchema.extend({
  signedUrl: z.string().url().optional(),
});

export type AttachmentResponse = z.infer<typeof attachmentResponseSchema>;

// ─── Query ──────────────────────────────────────────────────────────────────────

export const attachmentListQuerySchema = paginationQuerySchema.extend({
  echelonId: uuidSchema.optional(),
  summaryId: uuidSchema.optional(),
});

export type AttachmentListQuery = z.infer<typeof attachmentListQuerySchema>;

export const attachmentIdParamsSchema = z.object({ id: uuidSchema });

export type AttachmentIdParams = z.infer<typeof attachmentIdParamsSchema>;
