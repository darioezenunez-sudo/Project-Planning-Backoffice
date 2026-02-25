import { randomUUID } from 'node:crypto';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { StorageClient } from '@/lib/supabase/storage';
import { defaultBucket } from '@/lib/supabase/storage';
import type {
  AttachmentListQuery,
  AttachmentResponse,
  CreateAttachmentMetadataInput,
} from '@/schemas/attachment.schema';

import type { AttachmentRepository, AttachmentRow } from './attachment.repository';

const SIGNED_URL_EXPIRES_SECONDS = 3600;

export type UploadInput = {
  file: Buffer;
  metadata: CreateAttachmentMetadataInput;
  organizationId: string;
  userId?: string;
};

export type ListResult = {
  items: AttachmentRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function createAttachmentService(repo: AttachmentRepository, storageClient: StorageClient) {
  async function upload(input: UploadInput): Promise<Result<AttachmentRow, AppError>> {
    const { file, metadata, organizationId, userId } = input;
    const path = `${organizationId}/${randomUUID()}/${metadata.filename}`;
    const uploadResult = await storageClient.uploadFile(
      defaultBucket,
      path,
      file,
      metadata.mimeType,
    );
    if (!uploadResult.ok) return err(uploadResult.error);
    const row = await repo.create(organizationId, metadata, uploadResult.value, userId);
    return ok(row);
  }

  async function getDownloadUrl(
    id: string,
    organizationId: string,
  ): Promise<Result<AttachmentResponse, AppError>> {
    const row = await repo.findById(id, organizationId);
    if (!row) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Attachment ${id} not found`));
    }
    const urlResult = await storageClient.getSignedUrl(
      defaultBucket,
      row.storageKey,
      SIGNED_URL_EXPIRES_SECONDS,
    );
    if (!urlResult.ok) return err(urlResult.error);
    return ok({
      ...row,
      signedUrl: urlResult.value,
    });
  }

  async function list(
    organizationId: string,
    query: AttachmentListQuery,
  ): Promise<Result<ListResult, AppError>> {
    const result = await repo.findMany(organizationId, query);
    return ok({
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  }

  async function remove(
    id: string,
    organizationId: string,
    version: number,
  ): Promise<Result<void, AppError>> {
    const existing = await repo.findById(id, organizationId);
    if (!existing) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Attachment ${id} not found`));
    }
    const deleted = await repo.softDelete(id, organizationId, version);
    if (!deleted) {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, 'Version conflict — attachment was modified', {
          currentVersion: existing.version,
          requestedVersion: version,
        }),
      );
    }
    return ok(undefined);
  }

  return { upload, getDownloadUrl, list, remove };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
