import type { NextRequest } from 'next/server';

import { compose, type RouteContext } from '@/lib/middleware/compose';
import { withAudit } from '@/lib/middleware/with-audit';
import { withAuth } from '@/lib/middleware/with-auth';
import { withErrorHandling } from '@/lib/middleware/with-error-handling';
import { withTenant } from '@/lib/middleware/with-tenant';
import { withValidation } from '@/lib/middleware/with-validation';
import type { RouteContextWithValidated } from '@/lib/middleware/with-validation';
import { getRequestContext } from '@/lib/request-context';
import { createStorageClient } from '@/lib/supabase/storage';
import { apiSuccess } from '@/lib/utils/api-response';
import { createAttachmentRepository } from '@/modules/attachment/attachment.repository';
import { createAttachmentService } from '@/modules/attachment/attachment.service';
import { attachmentIdParamsSchema } from '@/schemas/attachment.schema';

const repo = createAttachmentRepository();
const storageClient = createStorageClient();
const service = createAttachmentService(repo, storageClient);

// GET /api/v1/attachments/:id — returns attachment with signed download URL
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withValidation({ params: attachmentIdParamsSchema }),
)(async (_req: NextRequest, context: RouteContext) => {
  const validated = (context as RouteContextWithValidated).validated;
  const params = validated.params as { id: string };
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await service.getDownloadUrl(params.id, organizationId);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value);
});

// DELETE /api/v1/attachments/:id?version=N — soft delete (optimistic locking)
export const DELETE = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withAudit('Attachment'),
  withValidation({ params: attachmentIdParamsSchema }),
)(async (req: NextRequest, context: RouteContext) => {
  const validated = (context as RouteContextWithValidated).validated;
  const params = validated.params as { id: string };
  const url = new URL(req.url);
  const version = Number(url.searchParams.get('version'));
  if (!Number.isFinite(version) || version < 1) {
    throw new Error('Query param ?version=N is required for delete');
  }

  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';

  const result = await service.remove(params.id, organizationId, version);
  if (!result.ok) throw result.error;

  return apiSuccess(null, {}, 204);
});
