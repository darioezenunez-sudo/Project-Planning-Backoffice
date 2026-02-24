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
import { createOrganizationRepository } from '@/modules/organization/organization.repository';
import { createOrganizationService } from '@/modules/organization/organization.service';
import { updateOrganizationSchema } from '@/schemas/organization.schema';

const repo = createOrganizationRepository();
const service = createOrganizationService(repo);

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// GET /api/v1/organizations/:id — any authenticated member of that org
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest, context: RouteContext) => {
  const id = await resolveId(context);
  // Verify the requested org matches the tenant from header (members can only see their own org)
  const ctx = getRequestContext();
  if (id !== ctx?.organizationId) {
    const result = await service.getById(id);
    if (!result.ok) throw result.error;
    return apiSuccess(result.value);
  }
  const result = await service.getById(id);
  if (!result.ok) throw result.error;
  return apiSuccess(result.value);
});

// PATCH /api/v1/organizations/:id — SUPER_ADMIN only
export const PATCH = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('SUPER_ADMIN'),
  withAudit('Organization'),
)(async (req: NextRequest, context: RouteContext) => {
  const id = await resolveId(context);

  const body = (await req.json()) as unknown;
  const input = updateOrganizationSchema.parse(body);

  const result = await service.update(id, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// DELETE /api/v1/organizations/:id — SUPER_ADMIN only
export const DELETE = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('SUPER_ADMIN'),
  withAudit('Organization'),
)(async (req: NextRequest, context: RouteContext) => {
  const id = await resolveId(context);

  const url = new URL(req.url);
  const version = Number(url.searchParams.get('version'));
  if (!Number.isFinite(version) || version < 1) {
    throw new Error('Query param ?version=N is required for delete');
  }

  const result = await service.remove(id, version);
  if (!result.ok) throw result.error;

  return apiSuccess(null, {}, 204);
});
