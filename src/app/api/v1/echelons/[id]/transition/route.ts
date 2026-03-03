import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withRole } from '@/lib/middleware/with-role';
import { withTenant } from '@/lib/middleware/with-tenant';
import { withValidation } from '@/lib/middleware/with-validation';
import type { RouteContextWithValidated } from '@/lib/middleware/with-validation';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createEchelonRepository } from '@/modules/echelon/echelon.repository';
import { createEchelonService } from '@/modules/echelon/echelon.service';
import type { EchelonEvent } from '@/modules/echelon/echelon.state-machine';
import { createRequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import { transitionEchelonSchema } from '@/schemas/echelon.schema';
import type { TransitionEchelonInput } from '@/schemas/echelon.schema';

const repo = createEchelonRepository();
const rfRepo = createRequiredFieldRepository();
const service = createEchelonService(repo, rfRepo);

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// PATCH /api/v1/echelons/:id/transition — FSM transition (event + version)
export const PATCH = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('MANAGER'),
  withValidation({ body: transitionEchelonSchema }),
  withAudit('Echelon'),
)(async (_req: NextRequest, context: RouteContext) => {
  const id = await resolveId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const input = (context as RouteContextWithValidated).validated.body as TransitionEchelonInput;

  const result = await service.transition(
    id,
    organizationId,
    input.event as EchelonEvent,
    input.version,
  );
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});
