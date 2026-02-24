import { buildConsolidationPrompt } from '@/lib/ai/consolidation.prompt';
import type { ConsolidationOutput } from '@/lib/ai/consolidation.schema';
import { CONSOLIDATION_MAX_INPUT_TOKENS, generateConsolidationReport } from '@/lib/ai/provider';
import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { EchelonRepository, EchelonRow } from '@/modules/echelon/echelon.repository';
import type { RequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import type { SummaryRepository } from '@/modules/summary/summary.repository';

/** Rough chars per token for input limit check. */
const CHARS_PER_TOKEN = 4;

export type ConsolidationResult = {
  echelon: EchelonRow;
  report: ConsolidationOutput;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
};

export function createConsolidationService(
  echelonRepo: EchelonRepository,
  summaryRepo: SummaryRepository,
  requiredFieldRepo: RequiredFieldRepository,
) {
  async function runConsolidation(
    echelonId: string,
    organizationId: string,
    version: number,
  ): Promise<Result<ConsolidationResult>> {
    const echelon = await echelonRepo.findById(echelonId, organizationId);
    if (!echelon) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${echelonId} not found`));
    }
    if (echelon.state !== 'CLOSING') {
      return err(
        new AppError(
          ErrorCode.ECHELON_INVALID_TRANSITION,
          422,
          `Echelon must be in CLOSING to run consolidation (current: ${echelon.state})`,
          { state: echelon.state },
        ),
      );
    }

    const [summaries, requiredFields] = await Promise.all([
      summaryRepo.findValidatedByEchelon(echelonId, organizationId),
      requiredFieldRepo.findManyByEchelon(echelonId, organizationId),
    ]);

    const summariesForPrompt = summaries.map((s) => ({
      sessionId: s.sessionId,
      content: s.editedContent ?? s.rawContent ?? '',
    }));

    const promptInput = {
      echelonName: echelon.name,
      echelonType:
        typeof echelon.configBlueprint === 'object' &&
        echelon.configBlueprint !== null &&
        'type' in echelon.configBlueprint
          ? String((echelon.configBlueprint as { type?: string }).type)
          : undefined,
      requiredFields: requiredFields.map((f) => ({
        label: f.label,
        description: f.description ?? undefined,
      })),
      summaries: summariesForPrompt,
    };

    const promptText = buildConsolidationPrompt(promptInput);
    const estimatedInputTokens = Math.ceil(promptText.length / CHARS_PER_TOKEN);
    if (estimatedInputTokens > CONSOLIDATION_MAX_INPUT_TOKENS) {
      return err(
        new AppError(
          ErrorCode.PAYLOAD_TOO_LARGE,
          413,
          `Consolidation input exceeds maximum tokens (estimated ${String(estimatedInputTokens)}, max ${String(CONSOLIDATION_MAX_INPUT_TOKENS)})`,
          { estimatedInputTokens, max: CONSOLIDATION_MAX_INPUT_TOKENS },
        ),
      );
    }

    const result = await generateConsolidationReport(promptText);
    if (!result.ok) {
      return err(
        new AppError(ErrorCode.INTERNAL_ERROR, 500, result.error.message, { cause: result.error }),
      );
    }

    const updated = await echelonRepo.setConsolidatedReport(
      echelonId,
      organizationId,
      result.output,
      version,
    );
    if (!updated) {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'Version conflict — echelon was modified by another request',
          { requestedVersion: version },
        ),
      );
    }

    return ok({
      echelon: updated,
      report: result.output,
      usage: result.usage,
    });
  }

  return { runConsolidation };
}

export type ConsolidationService = ReturnType<typeof createConsolidationService>;
