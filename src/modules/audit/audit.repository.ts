import type { AuditAction } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type CreateAuditLogInput = {
  organizationId?: string;
  actorId?: string;
  actorEmail?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  diff?: unknown;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export function createAuditRepository() {
  async function create(input: CreateAuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        diff: input.diff ?? undefined,
        requestId: input.requestId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async function findMany(params: {
    organizationId?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    limit?: number;
    cursor?: string;
  }) {
    const { limit = 50, cursor, ...where } = params;
    return prisma.auditLog.findMany({
      where: {
        ...where,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
  }

  return { create, findMany };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
