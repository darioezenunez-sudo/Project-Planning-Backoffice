import type { EchelonState, Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import { buildCursorPagination, encodeCursor } from '@/lib/utils/pagination';
import type {
  CreateEchelonInput,
  ListEchelonsQuery,
  UpdateEchelonInput,
} from '@/schemas/echelon.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const echelonSelect = {
  id: true,
  organizationId: true,
  productId: true,
  name: true,
  state: true,
  configBlueprint: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.EchelonSelect;

export type EchelonRow = Prisma.EchelonGetPayload<{ select: typeof echelonSelect }>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createEchelonRepository() {
  async function findById(id: string, organizationId: string): Promise<EchelonRow | null> {
    return prisma.echelon.findFirst({
      where: { id, organizationId },
      select: echelonSelect,
    });
  }

  async function findMany(
    organizationId: string,
    query: ListEchelonsQuery,
  ): Promise<{ items: EchelonRow[]; nextCursor: string | null; hasMore: boolean }> {
    const { cursor, limit } = buildCursorPagination(query);

    const where: Prisma.EchelonWhereInput = {
      organizationId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.state ? { state: query.state } : {}),
    };

    const items = await prisma.echelon.findMany({
      where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: echelonSelect,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id) : null;

    return { items: page, nextCursor, hasMore };
  }

  async function create(organizationId: string, input: CreateEchelonInput): Promise<EchelonRow> {
    return prisma.echelon.create({
      data: {
        organizationId,
        productId: input.productId,
        name: input.name,
        configBlueprint: input.configBlueprint ?? undefined,
      },
      select: echelonSelect,
    });
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateEchelonInput,
  ): Promise<EchelonRow | null> {
    const { version, ...fields } = input;
    const result = await prisma.echelon.updateMany({
      where: { id, organizationId, version },
      data: { ...fields, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function updateState(
    id: string,
    organizationId: string,
    state: EchelonState,
    version: number,
  ): Promise<EchelonRow | null> {
    const result = await prisma.echelon.updateMany({
      where: { id, organizationId, version },
      data: { state, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.echelon.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return { findById, findMany, create, update, updateState, softDelete };
}

export type EchelonRepository = ReturnType<typeof createEchelonRepository>;
