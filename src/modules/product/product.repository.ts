import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import { buildCursorPagination, encodeCursor } from '@/lib/utils/pagination';
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from '@/schemas/product.schema';

const productSelect = {
  id: true,
  organizationId: true,
  companyId: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.ProductSelect;

export type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export function createProductRepository() {
  async function findById(id: string, organizationId: string): Promise<ProductRow | null> {
    return prisma.product.findFirst({
      where: { id, organizationId },
      select: productSelect,
    });
  }

  async function findMany(
    organizationId: string,
    query: ListProductsQuery,
  ): Promise<{ items: ProductRow[]; nextCursor: string | null; hasMore: boolean }> {
    const { cursor, limit } = buildCursorPagination(query);

    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const items = await prisma.product.findMany({
      where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: productSelect,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]?.id ?? '') : null;

    return { items: page, nextCursor, hasMore };
  }

  async function create(organizationId: string, input: CreateProductInput): Promise<ProductRow> {
    return prisma.product.create({
      data: {
        organizationId,
        companyId: input.companyId,
        name: input.name,
        description: input.description ?? null,
      },
      select: productSelect,
    });
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateProductInput,
  ): Promise<ProductRow | null> {
    const { version, ...fields } = input;

    const result = await prisma.product.updateMany({
      where: { id, organizationId, version },
      data: { ...fields, version: { increment: 1 } },
    });

    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.product.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return { findById, findMany, create, update, softDelete };
}

export type ProductRepository = ReturnType<typeof createProductRepository>;
