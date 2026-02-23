import type { NextRequest } from 'next/server';

import { compose } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withRole } from '@/lib/middleware/with-role';
import { withTenant } from '@/lib/middleware/with-tenant';
import { apiSuccess } from '@/lib/utils/api-response';
import { createOrganizationRepository } from '@/modules/organization/organization.repository';
import { createOrganizationService } from '@/modules/organization/organization.service';
import { createOrganizationSchema } from '@/schemas/organization.schema';

const repo = createOrganizationRepository();
const service = createOrganizationService(repo);

// POST /api/v1/organizations — SUPER_ADMIN only
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withRole('SUPER_ADMIN'),
)(async (req: NextRequest) => {
  const body = (await req.json()) as unknown;
  const input = createOrganizationSchema.parse(body);

  const result = await service.create(input);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
