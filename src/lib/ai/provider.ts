import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';

import type { ConsolidationOutput } from './consolidation.schema';
import { consolidationOutputSchema } from './consolidation.schema';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
});

const DEFAULT_MODEL = 'gpt-4o-mini';
const modelId = process.env.AI_CONSOLIDATION_MODEL ?? DEFAULT_MODEL;

/** Max input tokens for consolidation; if exceeded return 413 (Fase 4). ~4 chars/token. */
export const CONSOLIDATION_MAX_INPUT_TOKENS = 120_000;

/** Default model for consolidation (Fase 4). Token tracking via usage. */
export function getConsolidationModel() {
  return openai(modelId);
}

export type ConsolidationUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type GenerateConsolidationResult =
  | { ok: true; output: ConsolidationOutput; usage: ConsolidationUsage }
  | { ok: false; error: Error; usage?: ConsolidationUsage };

type GenerateTextParams = Parameters<typeof generateText>[0];
type GenerateTextResultWithOutput = Awaited<ReturnType<typeof generateText>> & {
  output?: ConsolidationOutput;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
};

/**
 * Calls LLM with structured output schema. Returns output + usage for token tracking (UsageRecord).
 * Type assertions for AI SDK compatibility where SDK types omit output in some versions.
 */
export async function generateConsolidationReport(
  prompt: string,
): Promise<GenerateConsolidationResult> {
  try {
    const opts = {
      model: getConsolidationModel(),
      prompt,
      output: Output.object({
        schema: consolidationOutputSchema,
      }),
    };
    const result = (await generateText(
      opts as unknown as GenerateTextParams,
    )) as GenerateTextResultWithOutput;

    const output = result.output as ConsolidationOutput;
    const usage: ConsolidationUsage = {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    };

    return { ok: true, output, usage };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { ok: false, error: err };
  }
}
