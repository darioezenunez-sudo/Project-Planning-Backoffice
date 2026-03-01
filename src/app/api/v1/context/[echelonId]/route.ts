import type { NextRequest } from 'next/server';

import { getContextBundleFromCache, setContextBundleCache } from '@/lib/cache/context-cache';
import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createContextBundleService } from '@/modules/context-bundle/context-bundle.service';
import { createDecisionLinkRepository } from '@/modules/decision-link/decision-link.repository';
import { createEchelonRepository } from '@/modules/echelon/echelon.repository';
import { createRequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import { createSessionRepository } from '@/modules/session/session.repository';
import { createSummaryRepository } from '@/modules/summary/summary.repository';

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

// GET /api/v1/context/[echelonId] — Global context bundle (RequiredFields + ranked summaries + decision anchors). Cached in KV.
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRateLimit({ limit: 10, window: '5m' }),
)(async (_req: NextRequest, context: RouteContext) => {
  const echelonId = await resolveEchelonId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const cached = await getContextBundleFromCache(echelonId);
  if (cached !== null) return apiSuccess(cached);

  const result = await contextService.getContextBundle(echelonId, organizationId);
  if (!result.ok) throw result.error;

  const bundle = result.value;
  await setContextBundleCache(echelonId, bundle);

  return apiSuccess(bundle);
});
