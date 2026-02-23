import type { IdempotencyStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type IdempotencyRecord = {
  id: string;
  key: string;
  route: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: unknown;
  expiresAt: Date;
  createdAt: Date;
};

export function createIdempotencyRepository() {
  async function findByKey(key: string): Promise<IdempotencyRecord | null> {
    return prisma.idempotencyKey.findUnique({
      where: { key },
    }) as Promise<IdempotencyRecord | null>;
  }

  async function createProcessing(key: string, route: string): Promise<IdempotencyRecord> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL
    return prisma.idempotencyKey.create({
      data: { key, route, status: 'PROCESSING', expiresAt },
    }) as Promise<IdempotencyRecord>;
  }

  async function markCompleted(
    key: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: 'COMPLETED',
        responseStatus,
        responseBody: responseBody as Prisma.InputJsonValue,
      },
    });
  }

  async function markFailed(key: string): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { key },
      data: { status: 'FAILED' },
    });
  }

  async function deleteExpired(): Promise<number> {
    const result = await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  return { findByKey, createProcessing, markCompleted, markFailed, deleteExpired };
}

export type IdempotencyRepository = ReturnType<typeof createIdempotencyRepository>;
