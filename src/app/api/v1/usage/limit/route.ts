import { compose } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withTenant } from '@/lib/middleware/with-tenant';
import { apiSuccess } from '@/lib/utils/api-response';

const BUDGET_LIMIT_ENV = 'BUDGET_LIMIT_TOKENS_PER_ORG_MONTH';

// GET /api/v1/usage/limit — returns configured token limit per org/month (for charts).
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async () => {
  const limitRaw = process.env[BUDGET_LIMIT_ENV];
  const parsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  return apiSuccess({ limit });
});
