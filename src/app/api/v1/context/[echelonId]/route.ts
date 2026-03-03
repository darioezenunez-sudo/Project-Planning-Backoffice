import type { NextRequest } from 'next/server';

import { contextQueryEmbeddingSchema } from '@/contracts/assistant-api';
import { getContextBundleFromCache, setContextBundleCache } from '@/lib/cache/context-cache';
import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withTenant } from '@/lib/middleware/with-tenant';
import { findSummaryIdsBySimilarity } from '@/lib/pgvector';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createContextBundleService } from '@/modules/context-bundle/context-bundle.service';
import { createDecisionLinkRepository } from '@/modules/decision-link/decision-link.repository';
import { createEchelonRepository } from '@/modules/echelon/echelon.repository';
import { createRequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import { createSessionRepository } from '@/modules/session/session.repository';
import { createSummaryRepository } from '@/modules/summary/summary.repository';

const CONTEXT_SUMMARY_LIMIT = 50;

const echelonRepo = createEchelonRepository();
const requiredFieldRepo = createRequiredFieldRepository();
const summaryRepo = createSummaryRepository();
const sessionRepo = createSessionRepository();
const decisionLinkRepo = createDecisionLinkRepository();

const contextService = createContextBundleService({
  echelonRepo,
  requiredFieldRepo,
  summaryRepo,
  sessionRepo,
  decisionLinkRepo,
});

async function resolveEchelonId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['echelonId'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: echelonId');
  return id;
}

/**
 * Parse optional queryEmbedding from query string (base64url-encoded JSON array of 768 numbers).
 * Returns undefined if missing or invalid.
 */
function parseQueryEmbeddingFromRequest(req: NextRequest): number[] | undefined {
  const q = req.nextUrl.searchParams.get('queryEmbedding');
  if (!q) return undefined;
  try {
    const decoded = Buffer.from(q, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as unknown;
    const result = contextQueryEmbeddingSchema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

// GET /api/v1/context/[echelonId] — Global context bundle (RequiredFields + ranked summaries + decision anchors). Cached in KV.
// Optional query param queryEmbedding: base64url(JSON.stringify(number[768])) for pgvector ranked retrieval (H5).
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRateLimit({ limit: 10, window: '5m' }),
)(async (req: NextRequest, context: RouteContext) => {
  const echelonId = await resolveEchelonId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const queryEmbedding = parseQueryEmbeddingFromRequest(req);
  const useRankedRetrieval = queryEmbedding !== undefined;

  if (!useRankedRetrieval) {
    const cached = await getContextBundleFromCache(echelonId);
    if (cached !== null) return apiSuccess(cached);
  }

  let rankedSummaryIds: string[] | undefined;
  if (useRankedRetrieval) {
    rankedSummaryIds = await findSummaryIdsBySimilarity(
      echelonId,
      organizationId,
      queryEmbedding,
      CONTEXT_SUMMARY_LIMIT,
    );
  }

  const result = await contextService.getContextBundle(echelonId, organizationId, {
    rankedSummaryIds,
  });
  if (!result.ok) throw result.error;

  const bundle = result.value;
  if (!useRankedRetrieval) {
    await setContextBundleCache(echelonId, bundle);
  }

  return apiSuccess(bundle);
});
