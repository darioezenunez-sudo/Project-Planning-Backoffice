import type { NextRequest } from 'next/server';

import type { RouteContext } from '@/lib/middleware/compose';
import { compose } from '@/lib/middleware/compose';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withValidation } from '@/lib/middleware/with-validation';
import { prisma } from '@/lib/prisma';
import { getRequestContext } from '@/lib/request-context';
import { apiError, apiSuccess } from '@/lib/utils/api-response';
import { slugFromName } from '@/lib/utils/slug';
import { createMemberRepository } from '@/modules/member/member.repository';
import { createOrganizationRepository } from '@/modules/organization/organization.repository';
import { createOrganizationOnboardingSchema } from '@/schemas/organization.schema';
import type { CreateOrganizationOnboardingInput } from '@/schemas/organization.schema';

const orgRepo = createOrganizationRepository();
const memberRepo = createMemberRepository();

// POST /api/v1/auth/onboarding/create-organization — authenticated user with no org creates first org
export const POST = compose(
  withErrorHandling,
  withAuth,
  withValidation({ body: createOrganizationOnboardingSchema }),
)(async (_req: NextRequest, context: RouteContext) => {
  const ctx = getRequestContext();
  const userId = ctx?.userId ?? '';

  const existingMemberships = await prisma.organizationMember.count({
    where: { userId },
  });
  if (existingMemberships > 0) {
    return apiError('FORBIDDEN', 'User already belongs to an organization', 403);
  }

  const input = (
    context as RouteContext & { validated: { body: CreateOrganizationOnboardingInput } }
  ).validated.body;
  const baseSlug = slugFromName(input.name);
  let slug = baseSlug;
  let suffix = 0;
  while ((await orgRepo.findBySlug(slug)) != null) {
    suffix += 1;
    slug = `${baseSlug.slice(0, 55)}-${String(suffix)}`.slice(0, 60);
  }

  const org = await orgRepo.create({ name: input.name.trim(), slug });
  await memberRepo.create({
    organizationId: org.id,
    userId,
    role: 'ADMIN',
  });

  return apiSuccess(org, {}, 201);
});
