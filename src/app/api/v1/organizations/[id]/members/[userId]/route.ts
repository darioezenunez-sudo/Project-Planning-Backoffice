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
import { createMemberRepository } from '@/modules/member/member.repository';
import { createMemberService } from '@/modules/member/member.service';
import { updateMemberRoleSchema } from '@/schemas/member.schema';

const repo = createMemberRepository();
const service = createMemberService(repo);

async function resolveParams(context: RouteContext): Promise<{ orgId: string; userId: string }> {
  const params = await context.params;
  const orgId = params['id'];
  const userId = params['userId'];
  if (!orgId || Array.isArray(orgId)) throw new Error('Invalid route param: id');
  if (!userId || Array.isArray(userId)) throw new Error('Invalid route param: userId');
  return { orgId, userId };
}

// PATCH /api/v1/organizations/:id/members/:userId — ADMIN or SUPER_ADMIN
export const PATCH = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('ADMIN'),
  withAudit('OrganizationMember'),
)(async (req: NextRequest, context: RouteContext) => {
  const { orgId, userId } = await resolveParams(context);
  const ctx = getRequestContext();

  if (orgId !== ctx?.organizationId) throw new Error('Forbidden');

  const body = (await req.json()) as unknown;
  const input = updateMemberRoleSchema.parse(body);

  const result = await service.updateRole(orgId, userId, input.role);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// DELETE /api/v1/organizations/:id/members/:userId — ADMIN or SUPER_ADMIN
export const DELETE = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('ADMIN'),
  withAudit('OrganizationMember'),
)(async (_req: NextRequest, context: RouteContext) => {
  const { orgId, userId } = await resolveParams(context);
  const ctx = getRequestContext();

  if (orgId !== ctx?.organizationId) throw new Error('Forbidden');

  const result = await service.remove(orgId, userId);
  if (!result.ok) throw result.error;

  return apiSuccess(null, {}, 204);
});
