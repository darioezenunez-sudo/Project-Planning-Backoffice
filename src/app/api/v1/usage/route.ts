import type { NextRequest } from 'next/server';

import { assistantPostUsageSchema } from '@/contracts/assistant-api';
import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withIdempotency } from '@/lib/middleware/with-idempotency';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createBudgetRepository } from '@/modules/budget/budget.repository';
import { createBudgetService } from '@/modules/budget/budget.service';

const repo = createBudgetRepository();
const service = createBudgetService(repo);

// POST /api/v1/usage — Record LLM usage (idempotent). Assistant or backoffice.
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withIdempotency('POST /api/v1/usage'),
)(async (req: NextRequest, _context: RouteContext) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = assistantPostUsageSchema.parse(body);

  const result = await service.recordUsage(organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
