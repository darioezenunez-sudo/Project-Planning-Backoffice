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
import { createEchelonSchema, listEchelonsQuerySchema } from '@/schemas/echelon.schema';

const repo = createEchelonRepository();
const rfRepo = createRequiredFieldRepository();
const service = createEchelonService(repo, rfRepo);

// GET /api/v1/echelons?productId=...&state=...&cursor=...&limit=20
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (req: NextRequest) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const query = listEchelonsQuerySchema.parse(
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

// POST /api/v1/echelons
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('MANAGER'),
  withAudit('Echelon'),
)(async (req: NextRequest, _context: RouteContext) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = createEchelonSchema.parse(body);

  const result = await service.create(organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
