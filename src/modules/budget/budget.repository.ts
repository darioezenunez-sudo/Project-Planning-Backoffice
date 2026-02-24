import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { RecordUsageInput } from '@/schemas/usage.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const usageRecordSelect = {
  id: true,
  organizationId: true,
  productId: true,
  echelonId: true,
  monthYear: true,
  tokens: true,
  costCents: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.UsageRecordSelect;

export type UsageRecordRow = Prisma.UsageRecordGetPayload<{
  select: typeof usageRecordSelect;
}>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createBudgetRepository() {
  async function findByOrgAndMonth(
    organizationId: string,
    monthYear: string,
  ): Promise<UsageRecordRow[]> {
    return prisma.usageRecord.findMany({
      where: { organizationId, monthYear },
      select: usageRecordSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async function findOne(
    organizationId: string,
    monthYear: string,
    productId: string | null,
    echelonId: string | null,
  ): Promise<UsageRecordRow | null> {
    return prisma.usageRecord.findFirst({
      where: {
        organizationId,
        monthYear,
        productId,
        echelonId,
      },
      select: usageRecordSelect,
    });
  }

  async function create(organizationId: string, input: RecordUsageInput): Promise<UsageRecordRow> {
    return prisma.usageRecord.create({
      data: {
        organizationId,
        productId: input.productId ?? undefined,
        echelonId: input.echelonId ?? undefined,
        monthYear: input.monthYear,
        tokens: input.tokens,
        costCents: input.costCents,
      },
      select: usageRecordSelect,
    });
  }

  async function incrementUsage(
    id: string,
    organizationId: string,
    tokensDelta: number,
    costCentsDelta: number,
  ): Promise<UsageRecordRow | null> {
    const updated = await prisma.usageRecord.updateMany({
      where: { id, organizationId },
      data: {
        tokens: { increment: tokensDelta },
        costCents: { increment: costCentsDelta },
      },
    });
    if (updated.count === 0) return null;
    return prisma.usageRecord.findFirst({
      where: { id, organizationId },
      select: usageRecordSelect,
    });
  }

  return {
    findByOrgAndMonth,
    findOne,
    create,
    incrementUsage,
  };
}

export type BudgetRepository = ReturnType<typeof createBudgetRepository>;
