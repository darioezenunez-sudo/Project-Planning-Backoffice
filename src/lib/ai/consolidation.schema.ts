import { z } from 'zod';

/**
 * Schema for AI consolidation output (Fase 4).
 * RequiredFields appear as checklist; report is structured for CLOSURE_REVIEW.
 */
export const consolidationOutputSchema = z.object({
  executiveSummary: z.string().describe('Consolidated executive summary in 2-4 paragraphs'),
  decisions: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        rationale: z.string().optional(),
      }),
    )
    .describe('Key decisions extracted from session summaries'),
  checklist: z
    .array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
        met: z.boolean(),
        notes: z.string().optional(),
      }),
    )
    .describe('RequiredFields checklist: each item reflects whether the requirement was met'),
  risksAndMitigations: z
    .array(
      z.object({
        risk: z.string(),
        mitigation: z.string().optional(),
      }),
    )
    .optional()
    .describe('Risks and mitigations mentioned across summaries'),
});

export type ConsolidationOutput = z.infer<typeof consolidationOutputSchema>;
