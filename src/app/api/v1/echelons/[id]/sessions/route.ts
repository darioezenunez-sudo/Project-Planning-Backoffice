import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createEchelonRepository } from '@/modules/echelon/echelon.repository';
import { createSessionRepository } from '@/modules/session/session.repository';
import { createSessionService } from '@/modules/session/session.service';
import { createSessionSchema, listSessionsQuerySchema } from '@/schemas/session.schema';

const echelonRepo = createEchelonRepository();
const sessionRepo = createSessionRepository();
const service = createSessionService(sessionRepo, echelonRepo);

async function resolveEchelonId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params['id'];
  if (!id || Array.isArray(id)) throw new Error('Invalid route param: id');
  return id;
}

// GET /api/v1/echelons/:id/sessions
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (req: NextRequest, context: RouteContext) => {
  const echelonId = await resolveEchelonId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const query = listSessionsQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );

  const result = await service.listByEchelon(echelonId, organizationId, query);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value.items, {
    pagination: {
      cursor: result.value.nextCursor ?? undefined,
      hasMore: result.value.hasMore,
      limit: query.limit,
    },
  });
});

// POST /api/v1/echelons/:id/sessions
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withAudit('Session'),
)(async (req: NextRequest, context: RouteContext) => {
  const echelonId = await resolveEchelonId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = createSessionSchema.parse(body);

  const result = await service.create(echelonId, organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
