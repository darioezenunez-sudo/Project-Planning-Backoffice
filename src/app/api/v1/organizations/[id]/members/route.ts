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
import { inviteMemberSchema, listMembersQuerySchema } from '@/schemas/member.schema';

const repo = createMemberRepository();
const service = createMemberService(repo);

async function resolveOrgId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// GET /api/v1/organizations/:id/members — any member of the org
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (req: NextRequest, context: RouteContext) => {
  const organizationId = await resolveOrgId(context);
  const ctx = getRequestContext();

  // Users can only list members of their own org
  if (organizationId !== ctx?.organizationId) {
    throw new Error('Forbidden');
  }

  const query = listMembersQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );

  const result = await service.list(organizationId, query);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value.items, {
    pagination: {
      cursor: result.value.nextCursor ?? undefined,
      hasMore: result.value.hasMore,
      limit: query.limit,
    },
  });
});

// POST /api/v1/organizations/:id/members — ADMIN or SUPER_ADMIN
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('ADMIN'),
  withAudit('OrganizationMember'),
)(async (req: NextRequest, context: RouteContext) => {
  const organizationId = await resolveOrgId(context);

  const body = (await req.json()) as unknown;
  const input = inviteMemberSchema.parse(body);

  const result = await service.invite(organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
