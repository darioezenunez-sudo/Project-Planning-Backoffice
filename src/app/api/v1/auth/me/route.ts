import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { prisma } from '@/lib/prisma';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's memberships (organizationId + role).
 * Used by the browser auth-provider to discover which org to use.
 *
 * Auth: cookie session OR Bearer token.
 * No X-Organization-Id required — intentionally no withTenant.
 */
export const GET = compose(
  withErrorHandling,
  withAuth,
)(async (_req: NextRequest) => {
  const ctx = getRequestContext();
  const userId = ctx?.userId ?? '';

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: {
      organizationId: true,
      role: true,
      organization: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return apiSuccess({
    userId,
    memberships: memberships.map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      organizationName: m.organization.name,
    })),
  });
});
