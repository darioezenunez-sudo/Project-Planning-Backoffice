import type { Prisma, SummaryState } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import { buildCursorPagination, encodeCursor } from '@/lib/utils/pagination';
import type {
  CreateSummaryInput,
  ListSummariesQuery,
  UpdateSummaryInput,
} from '@/schemas/summary.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const summarySelect = {
  id: true,
  organizationId: true,
  sessionId: true,
  echelonId: true,
  state: true,
  rawContent: true,
  editedContent: true,
  reviewedAt: true,
  editedAt: true,
  validatedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.ExecutiveSummarySelect;

export type SummaryRow = Prisma.ExecutiveSummaryGetPayload<{ select: typeof summarySelect }>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createSummaryRepository() {
  async function findById(id: string, organizationId: string): Promise<SummaryRow | null> {
    return prisma.executiveSummary.findFirst({
      where: { id, organizationId },
      select: summarySelect,
    });
  }

  async function findBySession(
    sessionId: string,
    organizationId: string,
  ): Promise<SummaryRow | null> {
    return prisma.executiveSummary.findFirst({
      where: { sessionId, organizationId },
      select: summarySelect,
    });
  }

  async function findManyByEchelon(
    echelonId: string,
    organizationId: string,
    query: ListSummariesQuery,
  ): Promise<{ items: SummaryRow[]; nextCursor: string | null; hasMore: boolean }> {
    const { cursor, limit } = buildCursorPagination(query);

    const items = await prisma.executiveSummary.findMany({
      where: {
        echelonId,
        organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: summarySelect,
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
    sessionId: string,
    echelonId: string,
    organizationId: string,
    input: CreateSummaryInput,
  ): Promise<SummaryRow> {
    return prisma.executiveSummary.create({
      data: {
        sessionId,
        echelonId,
        organizationId,
        rawContent: input.rawContent ?? null,
      },
      select: summarySelect,
    });
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateSummaryInput,
  ): Promise<SummaryRow | null> {
    const { version, ...fields } = input;
    const result = await prisma.executiveSummary.updateMany({
      where: { id, organizationId, version },
      data: { ...fields, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function updateState(
    id: string,
    organizationId: string,
    state: SummaryState,
    timestamps: { reviewedAt?: Date; editedAt?: Date; validatedAt?: Date },
    version: number,
  ): Promise<SummaryRow | null> {
    const result = await prisma.executiveSummary.updateMany({
      where: { id, organizationId, version },
      data: { state, ...timestamps, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.executiveSummary.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return {
    findById,
    findBySession,
    findManyByEchelon,
    create,
    update,
    updateState,
    softDelete,
  };
}

export type SummaryRepository = ReturnType<typeof createSummaryRepository>;
