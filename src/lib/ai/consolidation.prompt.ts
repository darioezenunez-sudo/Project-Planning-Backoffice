/**
 * 6-layer consolidation prompt (Fase 4).
 * Layers: role, context (echelon type + RequiredFields), summaries, output rules, format.
 */

export type ConsolidationPromptInput = {
  echelonName: string;
  echelonType?: string;
  requiredFields: Array<{ label: string; description?: string | null }>;
  summaries: Array<{ sessionId: string; content: string }>;
};

const ROLE = `You are an expert analyst. Your task is to consolidate multiple session summaries into a single structured executive report. Be concise and factual.`;

function layerContext(input: ConsolidationPromptInput): string {
  const typeLine = input.echelonType ? `Echelon type: ${input.echelonType}.` : '';
  const fields =
    input.requiredFields.length > 0
      ? `Required fields (checklist): ${input.requiredFields
          .map((f) => (f.description ? `${f.label}: ${f.description}` : f.label))
          .join('; ')}.`
      : '';
  return `Context: Echelon "${input.echelonName}". ${typeLine} ${fields}`.trim();
}

function layerSummaries(summaries: Array<{ sessionId: string; content: string }>): string {
  if (summaries.length === 0) return 'No summaries provided.';
  return summaries.map((s) => `--- Session ${s.sessionId} ---\n${s.content.trim()}\n`).join('\n');
}

const OUTPUT_RULES = `Output rules:
- executiveSummary: 2-4 paragraphs synthesizing all sessions; no invented facts.
- decisions: list key decisions with title, description, optional rationale.
- checklist: one entry per required field; set met true/false based on evidence in summaries; optional notes.
- risksAndMitigations: optional list of risks and mitigations mentioned.`;

const FORMAT = `Respond with a single JSON object matching the schema. No markdown code fence.`;

/**
 * Builds the full consolidation prompt from the 6 layers.
 */
export function buildConsolidationPrompt(input: ConsolidationPromptInput): string {
  const parts = [
    ROLE,
    layerContext(input),
    'Summaries (validated):',
    layerSummaries(input.summaries),
    OUTPUT_RULES,
    FORMAT,
  ];
  return parts.join('\n\n');
}
