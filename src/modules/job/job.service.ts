import type { JobType } from '@prisma/client';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';

import type { JobPayload, JobRepository, JobRow } from './job.repository';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60 * 60 * 1000;

// ─── Service ───────────────────────────────────────────────────────────────────

export function createJobService(repo: JobRepository) {
  /**
   * Exponential backoff delay in ms for a given attempt (0-based).
   * Delay = min(BASE * 2^attempt, MAX_DELAY_MS).
   */
  function getNextRetryDelayMs(attempt: number): number {
    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    return Math.min(delay, MAX_DELAY_MS);
  }

  async function enqueue(
    type: JobType,
    payload: JobPayload,
    options?: { scheduledAt?: Date; maxAttempts?: number },
  ): Promise<Result<JobRow>> {
    const row = await repo.create(type, payload, {
      maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      scheduledAt: options?.scheduledAt,
    });
    return ok(row);
  }

  async function getById(id: string): Promise<Result<JobRow | null>> {
    const row = await repo.findById(id);
    return ok(row);
  }

  async function markRunning(id: string): Promise<Result<JobRow>> {
    const job = await repo.findById(id);
    if (!job) return err(new AppError(ErrorCode.NOT_FOUND, 404, `Job ${id} not found`));
    if (job.status !== 'PENDING' && job.status !== 'FAILED') {
      return err(
        new AppError(ErrorCode.CONFLICT, 409, `Job ${id} is not runnable (status: ${job.status})`),
      );
    }
    if (job.attempts >= job.maxAttempts) {
      return err(
        new AppError(ErrorCode.UNPROCESSABLE_ENTITY, 422, `Job ${id} exceeded max attempts`),
      );
    }
    const updated = await repo.updateStatus(id, 'RUNNING', { runAt: new Date() });
    if (!updated) return err(new AppError(ErrorCode.NOT_FOUND, 404, `Job ${id} not found`));
    return ok(updated);
  }

  async function markCompleted(id: string): Promise<Result<JobRow>> {
    const updated = await repo.updateStatus(id, 'COMPLETED', {
      completedAt: new Date(),
      errorMessage: null,
    });
    if (!updated) return err(new AppError(ErrorCode.NOT_FOUND, 404, `Job ${id} not found`));
    return ok(updated);
  }

  async function markFailed(id: string, errorMessage: string): Promise<Result<JobRow>> {
    const job = await repo.findById(id);
    if (!job) return err(new AppError(ErrorCode.NOT_FOUND, 404, `Job ${id} not found`));
    const scheduledAt =
      job.attempts + 1 < job.maxAttempts
        ? new Date(Date.now() + getNextRetryDelayMs(job.attempts))
        : undefined;
    const updated = await repo.incrementAttemptsAndSetError(id, errorMessage, {
      scheduledAt,
    });
    if (!updated) return err(new AppError(ErrorCode.NOT_FOUND, 404, `Job ${id} not found`));
    if (updated.status === 'DEAD_LETTER') {
      // Optional: trigger admin notification (e.g. enqueue alert job or call webhook)
    }
    return ok(updated);
  }

  /**
   * Jobs ready to run (PENDING or FAILED with attempts < maxAttempts and scheduledAt <= now).
   */
  async function listReadyToRun(limit: number): Promise<Result<JobRow[]>> {
    const rows = await repo.listReadyToRun(limit);
    const eligible = rows.filter((r) => r.attempts < r.maxAttempts);
    return ok(eligible);
  }

  /**
   * Reschedule a FAILED job for retry (sets status PENDING and scheduledAt to now + exponential backoff).
   */
  async function scheduleRetry(id: string): Promise<Result<JobRow>> {
    const job = await repo.findById(id);
    if (!job) return err(new AppError(ErrorCode.NOT_FOUND, 404, `Job ${id} not found`));
    if (job.status !== 'FAILED') return ok(job);
    const delayMs = getNextRetryDelayMs(job.attempts);
    const scheduledAt = new Date(Date.now() + delayMs);
    const updated = await repo.updateStatus(id, 'PENDING', { scheduledAt });
    if (!updated) return err(new AppError(ErrorCode.NOT_FOUND, 404, `Job ${id} not found`));
    return ok(updated);
  }

  return {
    enqueue,
    getById,
    markRunning,
    markCompleted,
    markFailed,
    listReadyToRun,
    scheduleRetry,
    getNextRetryDelayMs,
  };
}

export type JobService = ReturnType<typeof createJobService>;
