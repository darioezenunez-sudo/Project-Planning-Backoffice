import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import { buildCursorPagination, encodeCursor } from '@/lib/utils/pagination';
import type {
  CreateCompanyInput,
  ListCompaniesQuery,
  UpdateCompanyInput,
} from '@/schemas/company.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const companySelect = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  industry: true,
  website: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.CompanySelect;

export type CompanyRow = Prisma.CompanyGetPayload<{ select: typeof companySelect }>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createCompanyRepository() {
  async function findById(id: string, organizationId: string): Promise<CompanyRow | null> {
    return prisma.company.findFirst({
      where: { id, organizationId },
      select: companySelect,
    });
  }

  async function findMany(
    organizationId: string,
    query: ListCompaniesQuery,
  ): Promise<{ items: CompanyRow[]; nextCursor: string | null; hasMore: boolean }> {
    const { cursor, limit } = buildCursorPagination(query);

    const where: Prisma.CompanyWhereInput = {
      organizationId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { industry: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const items = await prisma.company.findMany({
      where: {
        ...where,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: companySelect,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]?.id ?? '') : null;

    return { items: page, nextCursor, hasMore };
  }

  async function create(organizationId: string, input: CreateCompanyInput): Promise<CompanyRow> {
    return prisma.company.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description ?? null,
        industry: input.industry ?? null,
        website: input.website ?? null,
      },
      select: companySelect,
    });
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateCompanyInput,
  ): Promise<CompanyRow | null> {
    const { version, ...fields } = input;

    // Optimistic locking: only update if version matches.
    const result = await prisma.company.updateMany({
      where: { id, organizationId, version },
      data: {
        ...fields,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) return null; // version mismatch or not found

    return findById(id, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.company.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return { findById, findMany, create, update, softDelete };
}

export type CompanyRepository = ReturnType<typeof createCompanyRepository>;
