import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
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
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// POST /api/v1/echelons/[id]/launch — Build launch payload (deep-link + context) for Assistant.
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest, context: RouteContext) => {
  const echelonId = await resolveEchelonId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await contextService.getContextBundle(echelonId, organizationId);
  if (!result.ok) throw result.error;

  const bundle = result.value;
  const appUrl = process.env.APP_URL ?? 'https://app.project-planning.local';
  const deepLinkUrl = `${appUrl}/echelon/${echelonId}?contextVersion=${String(bundle.version)}`;

  return apiSuccess({
    echelonId,
    deepLinkUrl,
    context: bundle,
  });
});
