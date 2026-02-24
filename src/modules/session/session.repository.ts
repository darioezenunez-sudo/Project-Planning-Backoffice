import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import { buildCursorPagination, encodeCursor } from '@/lib/utils/pagination';
import type {
  CreateSessionInput,
  ListSessionsQuery,
  UpdateSessionInput,
} from '@/schemas/session.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const sessionSelect = {
  id: true,
  organizationId: true,
  echelonId: true,
  sessionNumber: true,
  conductedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.SessionSelect;

export type SessionRow = Prisma.SessionGetPayload<{ select: typeof sessionSelect }>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createSessionRepository() {
  async function findById(id: string, organizationId: string): Promise<SessionRow | null> {
    return prisma.session.findFirst({
      where: { id, organizationId },
      select: sessionSelect,
    });
  }

  async function findManyByEchelon(
    echelonId: string,
    organizationId: string,
    query: ListSessionsQuery,
  ): Promise<{ items: SessionRow[]; nextCursor: string | null; hasMore: boolean }> {
    const { cursor, limit } = buildCursorPagination(query);

    const items = await prisma.session.findMany({
      where: {
        echelonId,
        organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: sessionSelect,
      orderBy: { sessionNumber: 'asc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id) : null;

    return { items: page, nextCursor, hasMore };
  }

  async function getNextSessionNumber(echelonId: string): Promise<number> {
    const result = await prisma.session.aggregate({
      where: { echelonId },
      _max: { sessionNumber: true },
    });
    return (result._max.sessionNumber ?? 0) + 1;
  }

  async function create(
    echelonId: string,
    organizationId: string,
    sessionNumber: number,
    input: CreateSessionInput,
  ): Promise<SessionRow> {
    return prisma.session.create({
      data: {
        echelonId,
        organizationId,
        sessionNumber,
        conductedAt: input.conductedAt ? new Date(input.conductedAt) : null,
        notes: input.notes ?? null,
      },
      select: sessionSelect,
    });
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateSessionInput,
  ): Promise<SessionRow | null> {
    const { version, conductedAt, ...rest } = input;
    const result = await prisma.session.updateMany({
      where: { id, organizationId, version },
      data: {
        ...rest,
        conductedAt: conductedAt !== undefined ? new Date(conductedAt) : undefined,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.session.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return { findById, findManyByEchelon, getNextSessionNumber, create, update, softDelete };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
