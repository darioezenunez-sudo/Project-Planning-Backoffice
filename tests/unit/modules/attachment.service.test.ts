import { describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import type { StorageClient } from '@/lib/supabase/storage';
import type {
  AttachmentRepository,
  AttachmentRow,
} from '@/modules/attachment/attachment.repository';
import { createAttachmentService } from '@/modules/attachment/attachment.service';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const ATTACHMENT_ID = '22222222-2222-2222-2222-222222222222';

function makeAttachment(overrides: Partial<AttachmentRow> = {}): AttachmentRow {
  return {
    id: ATTACHMENT_ID,
    organizationId: ORG_ID,
    executiveSummaryId: null,
    echelonId: null,
    filename: 'doc.pdf',
    storageKey: 'org/uuid/doc.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    uploadedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AttachmentRepository> = {}): AttachmentRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    create: vi.fn().mockResolvedValue(makeAttachment()),
    softDelete: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeStorage(overrides: Partial<StorageClient> = {}): StorageClient {
  return {
    uploadFile: vi.fn().mockResolvedValue({ ok: true, value: 'org/uuid/doc.pdf' }),
    getSignedUrl: vi
      .fn()
      .mockResolvedValue({ ok: true, value: 'https://signed.example.com/doc.pdf' }),
    deleteFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides,
  };
}

describe('createAttachmentService', () => {
  describe('upload', () => {
    it('uploads file to storage and persists metadata', async () => {
      const repo = makeRepo();
      const uploadFileMock = vi.fn().mockResolvedValue({ ok: true, value: 'org/uuid/doc.pdf' });
      const storage = makeStorage({ uploadFile: uploadFileMock });
      const service = createAttachmentService(repo, storage);

      const result = await service.upload({
        file: Buffer.from('content'),
        metadata: {
          filename: 'doc.pdf',
          mimeType: 'application/pdf',
          fileSize: 7,
        },
        organizationId: ORG_ID,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.filename).toBe('doc.pdf');
        expect(result.value.storageKey).toBe('org/uuid/doc.pdf');
      }
      expect(uploadFileMock).toHaveBeenCalledWith(
        'attachments',
        expect.stringContaining(ORG_ID),
        Buffer.from('content'),
        'application/pdf',
      );
      expect(repo.create).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({ filename: 'doc.pdf', mimeType: 'application/pdf', fileSize: 7 }),
        'org/uuid/doc.pdf',
        undefined,
      );
    });

    it('returns error when storage upload fails', async () => {
      const repo = makeRepo();
      const storage = makeStorage({
        uploadFile: vi.fn().mockResolvedValue({
          ok: false,
          error: new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, 'Storage error'),
        }),
      });
      const service = createAttachmentService(repo, storage);

      const result = await service.upload({
        file: Buffer.from('x'),
        metadata: { filename: 'a', mimeType: 'text/plain', fileSize: 1 },
        organizationId: ORG_ID,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      }
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('getDownloadUrl', () => {
    it('returns attachment with signed URL', async () => {
      const row = makeAttachment();
      const repo = makeRepo({ findById: vi.fn().mockResolvedValue(row) });
      const getSignedUrlMock = vi
        .fn()
        .mockResolvedValue({ ok: true, value: 'https://signed.example.com/doc.pdf' });
      const storage = makeStorage({ getSignedUrl: getSignedUrlMock });
      const service = createAttachmentService(repo, storage);

      const result = await service.getDownloadUrl(ATTACHMENT_ID, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.signedUrl).toBe('https://signed.example.com/doc.pdf');
        expect(result.value.id).toBe(ATTACHMENT_ID);
      }
      expect(getSignedUrlMock).toHaveBeenCalledWith('attachments', row.storageKey, 3600);
    });

    it('returns NOT_FOUND when attachment does not exist', async () => {
      const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      const getSignedUrlMock = vi
        .fn()
        .mockResolvedValue({ ok: true, value: 'https://example.com' });
      const storage = makeStorage({ getSignedUrl: getSignedUrlMock });
      const service = createAttachmentService(repo, storage);

      const result = await service.getDownloadUrl(ATTACHMENT_ID, ORG_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error.code).toBe(ErrorCode.NOT_FOUND);
      }
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns paginated items from repository', async () => {
      const items = [makeAttachment()];
      const repo = makeRepo({
        findMany: vi.fn().mockResolvedValue({
          items,
          nextCursor: 'next',
          hasMore: true,
        }),
      });
      const service = createAttachmentService(repo, makeStorage());

      const result = await service.list(ORG_ID, { limit: 20 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.nextCursor).toBe('next');
        expect(result.value.hasMore).toBe(true);
      }
      expect(repo.findMany).toHaveBeenCalledWith(ORG_ID, { limit: 20 });
    });
  });

  describe('remove', () => {
    it('soft-deletes when version matches', async () => {
      const row = makeAttachment({ version: 2 });
      const repo = makeRepo({
        findById: vi.fn().mockResolvedValue(row),
        softDelete: vi.fn().mockResolvedValue(true),
      });
      const service = createAttachmentService(repo, makeStorage());

      const result = await service.remove(ATTACHMENT_ID, ORG_ID, 2);

      expect(result.ok).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith(ATTACHMENT_ID, ORG_ID, 2);
    });

    it('returns NOT_FOUND when attachment does not exist', async () => {
      const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      const service = createAttachmentService(repo, makeStorage());

      const result = await service.remove(ATTACHMENT_ID, ORG_ID, 1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.NOT_FOUND);
      }
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it('returns CONFLICT when version mismatch', async () => {
      const row = makeAttachment({ version: 2 });
      const repo = makeRepo({
        findById: vi.fn().mockResolvedValue(row),
        softDelete: vi.fn().mockResolvedValue(false),
      });
      const service = createAttachmentService(repo, makeStorage());

      const result = await service.remove(ATTACHMENT_ID, ORG_ID, 1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CONFLICT);
      }
    });
  });
});
