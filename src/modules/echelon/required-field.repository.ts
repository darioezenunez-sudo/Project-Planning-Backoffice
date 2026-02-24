import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import type { CreateRequiredFieldInput, UpdateRequiredFieldInput } from '@/schemas/echelon.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const requiredFieldSelect = {
  id: true,
  organizationId: true,
  echelonId: true,
  label: true,
  description: true,
  isMet: true,
  metAt: true,
  metByUserId: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.RequiredFieldSelect;

export type RequiredFieldRow = Prisma.RequiredFieldGetPayload<{
  select: typeof requiredFieldSelect;
}>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createRequiredFieldRepository() {
  async function findById(id: string, organizationId: string): Promise<RequiredFieldRow | null> {
    return prisma.requiredField.findFirst({
      where: { id, organizationId },
      select: requiredFieldSelect,
    });
  }

  async function findManyByEchelon(
    echelonId: string,
    organizationId: string,
  ): Promise<RequiredFieldRow[]> {
    return prisma.requiredField.findMany({
      where: { echelonId, organizationId },
      select: requiredFieldSelect,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async function allMet(echelonId: string, organizationId: string): Promise<boolean> {
    const notMetCount = await prisma.requiredField.count({
      where: { echelonId, organizationId, isMet: false },
    });
    return notMetCount === 0;
  }

  async function hasAny(echelonId: string, organizationId: string): Promise<boolean> {
    const count = await prisma.requiredField.count({
      where: { echelonId, organizationId },
    });
    return count > 0;
  }

  async function create(
    echelonId: string,
    organizationId: string,
    input: CreateRequiredFieldInput,
  ): Promise<RequiredFieldRow> {
    return prisma.requiredField.create({
      data: {
        echelonId,
        organizationId,
        label: input.label,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
      },
      select: requiredFieldSelect,
    });
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateRequiredFieldInput,
  ): Promise<RequiredFieldRow | null> {
    const { version, isMet, metByUserId, ...rest } = input;

    let metAt: Date | null | undefined;
    if (isMet === true) {
      metAt = new Date();
    } else if (isMet === false) {
      metAt = null;
    }

    const result = await prisma.requiredField.updateMany({
      where: { id, organizationId, version },
      data: {
        ...rest,
        ...(isMet !== undefined ? { isMet } : {}),
        ...(metAt !== undefined ? { metAt } : {}),
        ...(metByUserId !== undefined ? { metByUserId } : {}),
        version: { increment: 1 },
      },
    });
    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.requiredField.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return { findById, findManyByEchelon, allMet, hasAny, create, update, softDelete };
}

export type RequiredFieldRepository = ReturnType<typeof createRequiredFieldRepository>;
