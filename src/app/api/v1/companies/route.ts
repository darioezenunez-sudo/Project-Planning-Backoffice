import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createCompanyRepository } from '@/modules/company/company.repository';
import { createCompanyService } from '@/modules/company/company.service';
import { createCompanySchema, listCompaniesQuerySchema } from '@/schemas/company.schema';

const repo = createCompanyRepository();
const service = createCompanyService(repo);

// GET /api/v1/companies?cursor=...&limit=20&search=...
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (req: NextRequest) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const query = listCompaniesQuerySchema.parse(
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

// POST /api/v1/companies
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withAudit('Company'),
)(async (req: NextRequest, _context: RouteContext) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = createCompanySchema.parse(body);

  const result = await service.create(organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
