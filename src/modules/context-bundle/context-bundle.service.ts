import type { ContextBundleResponse } from '@/contracts/assistant-api';
import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { DecisionLinkRepository } from '@/modules/decision-link/decision-link.repository';
import type { EchelonRepository } from '@/modules/echelon/echelon.repository';
import type { RequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import type { SessionRepository } from '@/modules/session/session.repository';
import type { SummaryRepository, SummaryRow } from '@/modules/summary/summary.repository';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CONTEXT_SUMMARY_LIMIT = 50;
/** Approximate chars per token for truncation. */
const CHARS_PER_TOKEN = 4;

// ─── Service factory ───────────────────────────────────────────────────────────

export type ContextBundleDeps = {
  echelonRepo: EchelonRepository;
  requiredFieldRepo: RequiredFieldRepository;
  summaryRepo: SummaryRepository;
  sessionRepo: SessionRepository;
  decisionLinkRepo: DecisionLinkRepository;
};

export function createContextBundleService(deps: ContextBundleDeps) {
  async function getContextBundle(
    echelonId: string,
    organizationId: string,
    options?: { maxTokens?: number; rankedSummaryIds?: string[] },
  ): Promise<Result<ContextBundleResponse>> {
    const echelon = await deps.echelonRepo.findById(echelonId, organizationId);
    if (echelon === null) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Echelon ${echelonId} not found`));
    }

    const [requiredFields, summaryResult] = await Promise.all([
      deps.requiredFieldRepo.findManyByEchelon(echelonId, organizationId),
      deps.summaryRepo.findManyByEchelon(echelonId, organizationId, {
        limit: CONTEXT_SUMMARY_LIMIT,
      }),
    ]);

    const orderedItems = orderSummariesByRank(summaryResult.items, options?.rankedSummaryIds);

    const rfIds = requiredFields.map((r) => r.id);
    const summaryIds = orderedItems.map((s) => s.id);
    const decisionLinks = await deps.decisionLinkRepo.findManyForEchelon(
      rfIds,
      summaryIds,
      organizationId,
    );

    const sessionIds = [...new Set(orderedItems.map((s) => s.sessionId))];
    const sessions =
      sessionIds.length > 0 ? await deps.sessionRepo.findManyByIds(sessionIds, organizationId) : [];
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    const maxTokens = options?.maxTokens ?? 8000;
    const totalCharLimit = maxTokens * CHARS_PER_TOKEN;

    const summaries = buildSummarySnippets(orderedItems, sessionMap, totalCharLimit);

    const response: ContextBundleResponse = {
      echelonId,
      version: echelon.version,
      requiredFields: requiredFields.map((r) => ({
        id: r.id,
        label: r.label,
        description: r.description,
        isMet: r.isMet,
        sortOrder: r.sortOrder,
      })),
      decisionAnchors: decisionLinks.map((d) => ({
        id: d.id,
        label: d.label,
        linkUrl: d.linkUrl,
        linkType: d.linkType,
        requiredFieldId: d.requiredFieldId,
        executiveSummaryId: d.executiveSummaryId,
      })),
      summaries,
    };

    return ok(response);
  }

  return { getContextBundle };
}

export type ContextBundleService = ReturnType<typeof createContextBundleService>;

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * When rankedSummaryIds is provided (from pgvector similarity), order items so that
 * those ids come first in that order; the rest follow with default sort (validated first, then createdAt).
 */
function orderSummariesByRank(
  items: SummaryRow[],
  rankedSummaryIds: string[] | undefined,
): SummaryRow[] {
  if (!rankedSummaryIds || rankedSummaryIds.length === 0) {
    return items;
  }
  const byId = new Map(items.map((s) => [s.id, s]));
  const ordered: SummaryRow[] = [];
  const seen = new Set<string>();
  for (const id of rankedSummaryIds) {
    const s = byId.get(id);
    if (s) {
      ordered.push(s);
      seen.add(s.id);
    }
  }
  const rest = items
    .filter((s) => !seen.has(s.id))
    .sort((a, b) => {
      const aVal = a.state === 'VALIDATED' ? 1 : 0;
      const bVal = b.state === 'VALIDATED' ? 1 : 0;
      if (bVal !== aVal) return bVal - aVal;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  return [...ordered, ...rest];
}

function buildSummarySnippets(
  items: SummaryRow[],
  sessionMap: Map<string, { sessionNumber: number }>,
  totalCharLimit: number,
): ContextBundleResponse['summaries'] {
  const validatedFirst = [...items].sort((a, b) => {
    const aVal = a.state === 'VALIDATED' ? 1 : 0;
    const bVal = b.state === 'VALIDATED' ? 1 : 0;
    if (bVal !== aVal) return bVal - aVal;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let used = 0;
  const snippets: ContextBundleResponse['summaries'] = [];

  for (const s of validatedFirst) {
    if (used >= totalCharLimit) break;
    const session = sessionMap.get(s.sessionId);
    const sessionNumber = session?.sessionNumber ?? 0;
    const content = s.editedContent ?? s.rawContent ?? '';
    const take = Math.min(content.length, totalCharLimit - used);
    const truncated = take < content.length ? `${content.slice(0, take)}…` : content;
    used += truncated.length;

    snippets.push({
      id: s.id,
      sessionId: s.sessionId,
      sessionNumber,
      state: s.state,
      content: truncated,
      validatedAt: s.validatedAt?.toISOString() ?? null,
    });
  }

  return snippets;
}
