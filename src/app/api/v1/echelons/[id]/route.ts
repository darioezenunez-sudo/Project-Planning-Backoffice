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
import { updateEchelonSchema } from '@/schemas/echelon.schema';

const repo = createEchelonRepository();
const rfRepo = createRequiredFieldRepository();
const service = createEchelonService(repo, rfRepo);

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// GET /api/v1/echelons/:id
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest, context: RouteContext) => {
  const id = await resolveId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await service.getById(id, organizationId);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// PATCH /api/v1/echelons/:id
export const PATCH = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('MANAGER'),
  withAudit('Echelon'),
)(async (req: NextRequest, context: RouteContext) => {
  const id = await resolveId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = updateEchelonSchema.parse(body);

  const result = await service.update(id, organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// DELETE /api/v1/echelons/:id
export const DELETE = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('ADMIN'),
  withAudit('Echelon'),
)(async (req: NextRequest, context: RouteContext) => {
  const id = await resolveId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const url = new URL(req.url);
  const version = Number(url.searchParams.get('version'));
  if (!Number.isFinite(version) || version < 1) {
    throw new Error('Query param ?version=N is required for delete');
  }

  const result = await service.remove(id, organizationId, version);
  if (!result.ok) throw result.error;

  return apiSuccess(null, {}, 204);
});
