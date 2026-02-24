import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import type { CreateDecisionLinkInput, UpdateDecisionLinkInput } from '@/schemas/echelon.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const decisionLinkSelect = {
  id: true,
  organizationId: true,
  requiredFieldId: true,
  executiveSummaryId: true,
  label: true,
  linkUrl: true,
  linkType: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.DecisionLinkSelect;

export type DecisionLinkRow = Prisma.DecisionLinkGetPayload<{
  select: typeof decisionLinkSelect;
}>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createDecisionLinkRepository() {
  async function findById(id: string, organizationId: string): Promise<DecisionLinkRow | null> {
    return prisma.decisionLink.findFirst({
      where: { id, organizationId },
      select: decisionLinkSelect,
    });
  }

  async function findManyByRequiredField(
    requiredFieldId: string,
    organizationId: string,
  ): Promise<DecisionLinkRow[]> {
    return prisma.decisionLink.findMany({
      where: { requiredFieldId, organizationId },
      select: decisionLinkSelect,
      orderBy: { id: 'asc' },
    });
  }

  async function findManyByExecutiveSummary(
    executiveSummaryId: string,
    organizationId: string,
  ): Promise<DecisionLinkRow[]> {
    return prisma.decisionLink.findMany({
      where: { executiveSummaryId, organizationId },
      select: decisionLinkSelect,
      orderBy: { id: 'asc' },
    });
  }

  async function create(
    organizationId: string,
    input: CreateDecisionLinkInput,
  ): Promise<DecisionLinkRow> {
    return prisma.decisionLink.create({
      data: {
        organizationId,
        requiredFieldId: input.requiredFieldId ?? null,
        executiveSummaryId: input.executiveSummaryId ?? null,
        label: input.label,
        linkUrl: input.linkUrl ?? null,
        linkType: input.linkType ?? null,
      },
      select: decisionLinkSelect,
    });
  }

  async function update(
    id: string,
    organizationId: string,
    input: UpdateDecisionLinkInput,
  ): Promise<DecisionLinkRow | null> {
    const { version, ...fields } = input;
    const result = await prisma.decisionLink.updateMany({
      where: { id, organizationId, version },
      data: { ...fields, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return findById(id, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.decisionLink.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return {
    findById,
    findManyByRequiredField,
    findManyByExecutiveSummary,
    create,
    update,
    softDelete,
  };
}

export type DecisionLinkRepository = ReturnType<typeof createDecisionLinkRepository>;
