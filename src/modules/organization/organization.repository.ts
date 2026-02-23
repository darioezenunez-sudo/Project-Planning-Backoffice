import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';

const organizationSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  version: true,
} satisfies Prisma.OrganizationSelect;

export type OrganizationRecord = Prisma.OrganizationGetPayload<{
  select: typeof organizationSelect;
}>;

export function createOrganizationRepository() {
  async function findById(id: string): Promise<OrganizationRecord | null> {
    return prisma.organization.findFirst({ where: { id }, select: organizationSelect });
  }

  async function findBySlug(slug: string): Promise<OrganizationRecord | null> {
    return prisma.organization.findFirst({ where: { slug }, select: organizationSelect });
  }

  async function create(data: { name: string; slug: string }): Promise<OrganizationRecord> {
    return prisma.organization.create({ data, select: organizationSelect });
  }

  async function update(
    id: string,
    version: number,
    data: Partial<{ name: string }>,
  ): Promise<OrganizationRecord | null> {
    const result = await prisma.organization.updateMany({
      where: { id, version, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return findById(id);
  }

  async function softDelete(id: string, version: number): Promise<boolean> {
    const result = await prisma.organization.updateMany({
      where: { id, version, deletedAt: null },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return { findById, findBySlug, create, update, softDelete };
}

export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>;
