import type { JobStatus, JobType } from '@prisma/client';

import { prisma } from '@/lib/prisma';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type JobPayload = Record<string, unknown>;

export type JobRow = {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: JobPayload;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  runAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Repository ───────────────────────────────────────────────────────────────

export function createJobRepository() {
  async function create(
    type: JobType,
    payload: JobPayload,
    options?: { scheduledAt?: Date; maxAttempts?: number },
  ): Promise<JobRow> {
    const scheduledAt = options?.scheduledAt ?? new Date();
    const maxAttempts = options?.maxAttempts ?? 3;
    const row = await prisma.job.create({
      data: { type, payload, scheduledAt, maxAttempts },
    });
    return row as JobRow;
  }

  async function findById(id: string): Promise<JobRow | null> {
    const row = await prisma.job.findUnique({ where: { id } });
    return row as JobRow | null;
  }

  async function updateStatus(
    id: string,
    status: JobStatus,
    updates?: {
      runAt?: Date;
      completedAt?: Date;
      errorMessage?: string | null;
      scheduledAt?: Date;
    },
  ): Promise<JobRow | null> {
    const result = await prisma.job.updateMany({
      where: { id },
      data: { status, ...updates },
    });
    if (result.count === 0) return null;
    return findById(id);
  }

  async function incrementAttemptsAndSetError(
    id: string,
    errorMessage: string,
    options?: { scheduledAt?: Date },
  ): Promise<JobRow | null> {
    const job = await findById(id);
    if (!job) return null;
    const attempts = job.attempts + 1;
    const status: JobStatus = attempts >= job.maxAttempts ? 'DEAD_LETTER' : 'FAILED';
    await prisma.job.update({
      where: { id },
      data: {
        attempts,
        status,
        errorMessage,
        ...(options?.scheduledAt && { scheduledAt: options.scheduledAt }),
      },
    });
    return findById(id);
  }

  /**
   * List jobs ready to run: PENDING or FAILED with scheduledAt <= now, ordered by scheduledAt.
   * Caller must filter by attempts < maxAttempts before processing.
   */
  async function listReadyToRun(limit: number): Promise<JobRow[]> {
    const now = new Date();
    const rows = await prisma.job.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return rows as JobRow[];
  }

  return {
    create,
    findById,
    updateStatus,
    incrementAttemptsAndSetError,
    listReadyToRun,
  };
}

export type JobRepository = ReturnType<typeof createJobRepository>;
