import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createDecisionLinkRepository } from '@/modules/decision-link/decision-link.repository';
import { createDecisionLinkService } from '@/modules/decision-link/decision-link.service';
import { createDecisionLinkSchema } from '@/schemas/echelon.schema';

const repo = createDecisionLinkRepository();
const service = createDecisionLinkService(repo);

async function resolveRequiredFieldId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// GET /api/v1/required-fields/:id/decision-links
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest, context: RouteContext) => {
  const requiredFieldId = await resolveRequiredFieldId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await service.listByRequiredField(requiredFieldId, organizationId);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// POST /api/v1/required-fields/:id/decision-links
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withAudit('DecisionLink'),
)(async (req: NextRequest, context: RouteContext) => {
  const requiredFieldId = await resolveRequiredFieldId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = createDecisionLinkSchema.parse({ ...(body as object), requiredFieldId });

  const result = await service.create(organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
