import type { NextRequest } from 'next/server';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
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
import {
  attachmentListQuerySchema,
  createAttachmentSchema,
  type AttachmentListQuery,
  type CreateAttachmentInput,
} from '@/schemas/attachment.schema';

const repo = createAttachmentRepository();
const storageClient = createStorageClient();
const service = createAttachmentService(repo, storageClient);

// GET /api/v1/attachments?cursor=...&limit=20&echelonId=...&summaryId=...
export const GET = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withValidation({ query: attachmentListQuerySchema }),
)(async (_req: NextRequest, context: RouteContext) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';
  const validated = (context as RouteContextWithValidated).validated;
  const query = validated.query as AttachmentListQuery;

  const result = await service.list(organizationId, query);
  if (!result.ok) throw result.error;

  return apiSuccess(result.value.items, {
    pagination: {
      cursor: result.value.nextCursor ?? undefined,
      hasMore: result.value.hasMore,
      limit: query.limit,
    },
  });
});

// POST /api/v1/attachments — upload (body: createAttachmentSchema with optional content base64)
export const POST = compose(
  withErrorHandling,
  withAuth,
  withTenant,
  withAudit('Attachment'),
  withValidation({ body: createAttachmentSchema }),
)(async (_req: NextRequest, context: RouteContext) => {
  const ctx = getRequestContext();
  const organizationId = ctx?.organizationId ?? '';
  const userId = ctx?.userId;
  const validated = (context as RouteContextWithValidated).validated;
  const body = validated.body as CreateAttachmentInput;

  const content = body.content;
  if (!content) {
    throw new AppError(ErrorCode.BAD_REQUEST, 400, 'content (base64) is required for upload');
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(content, 'base64');
  } catch {
    throw new AppError(ErrorCode.BAD_REQUEST, 400, 'content must be valid base64');
  }

  const metadata = {
    filename: body.filename,
    mimeType: body.mimeType,
    fileSize: body.fileSize,
    executiveSummaryId: body.executiveSummaryId,
    echelonId: body.echelonId,
  };

  const result = await service.upload({
    file: buffer,
    metadata,
    organizationId,
    userId,
  });
  if (!result.ok) throw result.error;

  return apiSuccess(result.value, {}, 201);
});
