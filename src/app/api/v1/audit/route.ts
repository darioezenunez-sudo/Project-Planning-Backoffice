import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { compose } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withRole } from '@/lib/middleware/with-role';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createAuditRepository } from '@/modules/audit/audit.repository';
import { createAuditService } from '@/modules/audit/audit.service';

const repo = createAuditRepository();
const service = createAuditService(repo);

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

// GET /api/v1/audit?limit=50&cursor=...&entityType=...&entityId=...
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('ADMIN'),
)(async (req: NextRequest) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const query = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));

  const rows = await service.getByEntity({
    organizationId,
    entityType: query.entityType,
    entityId: query.entityId,
    limit: query.limit,
    cursor: query.cursor,
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem != null ? lastItem.id : undefined;

  return apiSuccess(items, {
    pagination: { cursor: nextCursor, hasMore, limit: query.limit },
  });
});
