import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import { buildCursorPagination, encodeCursor } from '@/lib/utils/pagination';
import type {
  AttachmentListQuery,
  CreateAttachmentMetadataInput,
} from '@/schemas/attachment.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const attachmentSelect = {
  id: true,
  organizationId: true,
  executiveSummaryId: true,
  echelonId: true,
  filename: true,
  storageKey: true,
  mimeType: true,
  fileSize: true,
  uploadedByUserId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.AttachmentSelect;

export type AttachmentRow = Prisma.AttachmentGetPayload<{
  select: typeof attachmentSelect;
}>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createAttachmentRepository() {
  async function findById(id: string, organizationId: string): Promise<AttachmentRow | null> {
    return prisma.attachment.findFirst({
      where: { id, organizationId },
      select: attachmentSelect,
    });
  }

  async function findMany(
    organizationId: string,
    query: AttachmentListQuery,
  ): Promise<{ items: AttachmentRow[]; nextCursor: string | null; hasMore: boolean }> {
    const { cursor, limit } = buildCursorPagination(query);

    const where: Prisma.AttachmentWhereInput = {
      organizationId,
      ...(query.echelonId ? { echelonId: query.echelonId } : {}),
      ...(query.summaryId ? { executiveSummaryId: query.summaryId } : {}),
    };

    const items = await prisma.attachment.findMany({
      where: {
        ...where,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: attachmentSelect,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id) : null;

    return { items: page, nextCursor, hasMore };
  }

  async function create(
    organizationId: string,
    input: CreateAttachmentMetadataInput,
    storageKey: string,
    uploadedByUserId?: string,
  ): Promise<AttachmentRow> {
    return prisma.attachment.create({
      data: {
        organizationId,
        executiveSummaryId: input.executiveSummaryId ?? null,
        echelonId: input.echelonId ?? null,
        filename: input.filename,
        storageKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedByUserId: uploadedByUserId ?? null,
      },
      select: attachmentSelect,
    });
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.attachment.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return { findById, findMany, create, softDelete };
}

export type AttachmentRepository = ReturnType<typeof createAttachmentRepository>;
