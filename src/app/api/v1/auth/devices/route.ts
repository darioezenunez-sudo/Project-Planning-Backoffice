import type { NextRequest } from 'next/server';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withIdempotency } from '@/lib/middleware/with-idempotency';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createDeviceRepository } from '@/modules/auth/device.repository';
import { createDeviceService } from '@/modules/auth/device.service';
import { enrollDeviceSchema } from '@/schemas/device.schema';

const repo = createDeviceRepository();
const service = createDeviceService(repo);

// POST /api/v1/auth/devices — Device enrollment (idempotent).
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withIdempotency('POST /api/v1/auth/devices'),
  withAudit('Device'),
)(async (req: NextRequest, _context: RouteContext) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const body = (await req.json()) as unknown;
  const input = enrollDeviceSchema.parse(body);

  // Fix O3: validate that userId in request body matches the authenticated user
  const authenticatedUserId = ctx?.userId;
  if (authenticatedUserId === undefined) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, 'Authentication required');
  }
  if (input.userId !== authenticatedUserId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      403,
      'userId in request body must match the authenticated user',
    );
  }

  const result = await service.enroll(organizationId, input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
