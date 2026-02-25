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
import { createJobRepository } from '@/modules/job/job.repository';
import { createJobService } from '@/modules/job/job.service';

const repo = createBudgetRepository();
const service = createBudgetService(repo);
const jobRepo = createJobRepository();
const jobService = createJobService(jobRepo);

const BUDGET_LIMIT_ENV = 'BUDGET_LIMIT_TOKENS_PER_ORG_MONTH';

// POST /api/v1/usage — Record LLM usage (idempotent). Assistant or backoffice. Fase 4: budget alerts.
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

  const limitRaw = process.env[BUDGET_LIMIT_ENV];
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
  if (Number.isFinite(limit) && limit > 0) {
    const usageResult = await service.getUsageByOrgAndMonth(organizationId, input.monthYear);
    if (usageResult.ok) {
      const totalTokens = usageResult.value.reduce((acc, r) => acc + r.tokens, 0);
      const percentage = Math.floor((totalTokens / limit) * 100);
      if (percentage >= 80) {
        await jobService.enqueue('BUDGET_ALERT', {
          organizationId,
          monthYear: input.monthYear,
          totalTokens,
          limit,
          percentage,
        });
      }
    }
  }

  return apiSuccess(result.value, {}, 201);
});
