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
import { createRequiredFieldRepository } from '@/modules/echelon/required-field.repository';
import { createRequiredFieldService } from '@/modules/echelon/required-field.service';
import { createRequiredFieldSchema } from '@/schemas/echelon.schema';

const repo = createRequiredFieldRepository();
const service = createRequiredFieldService(repo);

async function resolveEchelonId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// GET /api/v1/echelons/:id/required-fields
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest, context: RouteContext) => {
  const echelonId = await resolveEchelonId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await service.listByEchelon(echelonId, organizationId);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// POST /api/v1/echelons/:id/required-fields
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('MANAGER'),
  withAudit('RequiredField'),
)(async (req: NextRequest, context: RouteContext) => {
  const echelonId = await resolveEchelonId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = createRequiredFieldSchema.parse(body);

  const result = await service.create(echelonId, organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
