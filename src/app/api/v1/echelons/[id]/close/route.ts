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
import { createEchelonRepository } from '@/modules/echelon/echelon.repository';
import { createEchelonService } from '@/modules/echelon/echelon.service';
import { createRequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import { createIntegrationEngine } from '@/modules/integration/integration.engine';
import { createArchitectureStrategy } from '@/modules/integration/strategies/architecture.strategy';
import { createDefaultStrategy } from '@/modules/integration/strategies/default.strategy';
import { createPmStrategy } from '@/modules/integration/strategies/pm.strategy';
import { createJobRepository } from '@/modules/job/job.repository';
import { createJobService } from '@/modules/job/job.service';

const repo = createEchelonRepository();
const rfRepo = createRequiredFieldRepository();
const service = createEchelonService(repo, rfRepo);

const jobRepo = createJobRepository();
const jobService = createJobService(jobRepo);
const defaultStrategy = createDefaultStrategy(jobService);
const integrationEngine = createIntegrationEngine({
  defaultStrategy,
  pmStrategy: createPmStrategy(defaultStrategy),
  architectureStrategy: createArchitectureStrategy(defaultStrategy),
});

// POST /api/v1/echelons/:id/close — transition to CLOSED then run integration (PDF + email jobs)
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

  const result = await service.close(id, organizationId, version);
  if (!result.ok) throw result.error;

  const integrationResult = await integrationEngine.execute(result.value);
  if (!integrationResult.ok) throw integrationResult.error;

  return apiSuccess(result.value);
});
