import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withRole } from '@/lib/middleware/with-role';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createConsolidationService } from '@/modules/consolidation/consolidation.service';
import { createEchelonRepository } from '@/modules/echelon/echelon.repository';
import { createEchelonService } from '@/modules/echelon/echelon.service';
import { createRequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import { createSummaryRepository } from '@/modules/summary/summary.repository';

const repo = createEchelonRepository();
const rfRepo = createRequiredFieldRepository();
const summaryRepo = createSummaryRepository();
const service = createEchelonService(repo, rfRepo);
const consolidationService = createConsolidationService(repo, summaryRepo, rfRepo);

// POST /api/v1/echelons/:id/consolidate — transition to CLOSING then run AI consolidation → CLOSURE_REVIEW
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('MANAGER'),
  withAudit('Echelon'),
)(async (req: NextRequest, context: RouteContext) => {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');

  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as { version?: unknown };
  const version = Number(body.version);
  if (!Number.isFinite(version) || version < 1) {
    throw new Error('Body field `version` (integer ≥ 1) is required');
  }

  const transitionResult = await service.consolidate(id, organizationId, version);
  if (!transitionResult.ok) throw transitionResult.error;

  const consolidationResult = await consolidationService.runConsolidation(
    id,
    organizationId,
    transitionResult.value.version,
  );
  if (!consolidationResult.ok) throw consolidationResult.error;

  return apiSuccess({
    echelon: consolidationResult.value.echelon,
    usage: consolidationResult.value.usage,
  });
});
