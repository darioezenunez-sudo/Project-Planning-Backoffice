import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import type { RouteContext } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withRole } from '@/lib/middleware/with-role';
import { withTenant } from '@/lib/middleware/with-tenant';
import { getRequestContext } from '@/lib/request-context';
import { apiSuccess } from '@/lib/utils/api-response';
import { createDeviceRepository } from '@/modules/auth/device.repository';
import { createDeviceService } from '@/modules/auth/device.service';

const repo = createDeviceRepository();
const service = createDeviceService(repo);

async function resolveMachineId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const machineId = params['machineId'];
  if (!machineId || Array.isArray(machineId)) throw new Error('Invalid route param: machineId');
  return machineId;
}

// GET /api/v1/auth/devices/[machineId] — Device validation (Assistant). Rate limit: 10 req/5min per machineId.
export const GET = compose(
  withErrorHandling,
  withRateLimit({ limit: 10, window: '5min' }),
)(async (req: NextRequest, context: RouteContext) => {
  const machineId = await resolveMachineId(context);

  const result = await service.validate(machineId);
  if (!result.ok) throw result.error;

  const { device, accessToken, expiresAt } = result.value;
  return apiSuccess({
    machineId: device.machineId,
    organizationId: device.organizationId,
    userId: device.userId,
    accessToken,
    expiresAt: expiresAt.toISOString(),
  });
});

// DELETE /api/v1/auth/devices/[machineId] — Revoke device (admin only).
export const DELETE = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('ADMIN'),
)(async (_req: NextRequest, context: RouteContext) => {
  const machineId = await resolveMachineId(context);
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await service.revoke(machineId, organizationId);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});
