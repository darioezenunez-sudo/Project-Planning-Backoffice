/**
 * Zod schemas for Assistant ↔ Backoffice integration (Fase 3).
 * Single source of truth for request/response shapes; exportable for OpenAPI and contract tests.
 */
import { z } from 'zod';

import {
  deviceResponseSchema,
  deviceValidationResponseSchema,
  enrollDeviceSchema,
} from '@/schemas/device.schema';
import { uuidSchema } from '@/schemas/shared.schema';
import { recordUsageSchema, usageRecordResponseSchema } from '@/schemas/usage.schema';

// ─── Device ────────────────────────────────────────────────────────────────────

export const assistantDeviceEnrollSchema = enrollDeviceSchema;
export type AssistantDeviceEnrollInput = z.infer<typeof assistantDeviceEnrollSchema>;

export const assistantDeviceResponseSchema = deviceResponseSchema;
export const assistantDeviceValidationResponseSchema = deviceValidationResponseSchema;

// ─── Context Bundle (GET /context/[echelonId]) ────────────────────────────────

/** Query embedding (768 dims) for ranked retrieval. Sent as base64url(JSON.stringify(number[])) on GET. */
export const CONTEXT_QUERY_EMBEDDING_DIMS = 768;
export const contextQueryEmbeddingSchema = z.array(z.number()).length(CONTEXT_QUERY_EMBEDDING_DIMS);

export const requiredFieldAnchorSchema = z.object({
  id: uuidSchema,
  label: z.string(),
  description: z.string().nullable(),
  isMet: z.boolean(),
  sortOrder: z.number().int(),
});
export type RequiredFieldAnchor = z.infer<typeof requiredFieldAnchorSchema>;

export const decisionAnchorSchema = z.object({
  id: uuidSchema,
  label: z.string(),
  linkUrl: z.string().nullable(),
  linkType: z.string().nullable(),
  requiredFieldId: uuidSchema.nullable(),
  executiveSummaryId: uuidSchema.nullable(),
});
export type DecisionAnchor = z.infer<typeof decisionAnchorSchema>;

/** Single summary snippet for context (ranked retrieval). */
export const contextSummarySnippetSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  sessionNumber: z.number().int(),
  state: z.enum(['DRAFT', 'REVIEW', 'EDITED', 'VALIDATED']),
  content: z.string(),
  validatedAt: z.string().datetime({ offset: true }).nullable(),
});
export type ContextSummarySnippet = z.infer<typeof contextSummarySnippetSchema>;

export const contextBundleResponseSchema = z.object({
  echelonId: uuidSchema,
  version: z.number().int(),
  requiredFields: z.array(requiredFieldAnchorSchema),
  decisionAnchors: z.array(decisionAnchorSchema),
  /** Ranked summaries (e.g. pgvector similarity), token-limited. */
  summaries: z.array(contextSummarySnippetSchema),
});
export type ContextBundleResponse = z.infer<typeof contextBundleResponseSchema>;

// ─── Launch (POST /echelons/[id]/launch) ───────────────────────────────────────

export const launchPayloadResponseSchema = z.object({
  echelonId: uuidSchema,
  deepLinkUrl: z.string().url(),
  /** Same shape as context bundle for Assistant to bootstrap. */
  context: contextBundleResponseSchema,
});
export type LaunchPayloadResponse = z.infer<typeof launchPayloadResponseSchema>;

// ─── POST Summary (POST /sessions/[id]/summary) — Assistant sends summary ──────

/** Assistant sends rawContent and optional embedding (768 dims). */
export const assistantPostSummarySchema = z.object({
  rawContent: z.string().max(50000).optional(),
  /** Optional embedding vector for ranked retrieval (768 dimensions). */
  embedding: z.array(z.number()).length(768).optional(),
});
export type AssistantPostSummaryInput = z.infer<typeof assistantPostSummarySchema>;

// ─── POST Usage (POST /usage) ──────────────────────────────────────────────────

export const assistantPostUsageSchema = recordUsageSchema;
export type AssistantPostUsageInput = z.infer<typeof assistantPostUsageSchema>;
export const assistantUsageResponseSchema = usageRecordResponseSchema;

// ─── Re-exports for OpenAPI / tests ────────────────────────────────────────────

export const assistantSchemas = {
  device: {
    enroll: assistantDeviceEnrollSchema,
    response: assistantDeviceResponseSchema,
    validationResponse: assistantDeviceValidationResponseSchema,
  },
  context: {
    bundle: contextBundleResponseSchema,
  },
  launch: {
    payload: launchPayloadResponseSchema,
  },
  summary: {
    post: assistantPostSummarySchema,
  },
  usage: {
    post: assistantPostUsageSchema,
    response: assistantUsageResponseSchema,
  },
} as const;
