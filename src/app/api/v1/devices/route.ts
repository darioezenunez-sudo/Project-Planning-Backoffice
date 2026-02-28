import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createDeviceRepository } from '@/modules/auth/device.repository';
import { createDeviceService } from '@/modules/auth/device.service';

const repo = createDeviceRepository();
const service = createDeviceService(repo);

// GET /api/v1/devices — List devices registered to the organization (backoffice UI).
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
)(async (_req: NextRequest) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await service.list(organizationId);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});
