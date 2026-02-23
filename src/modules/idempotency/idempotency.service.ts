import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';

import type { IdempotencyRepository } from './idempotency.repository';

export type IdempotencyCheckResult =
  | { status: 'new' }
  | { status: 'processing' }
  | { status: 'completed'; responseStatus: number; responseBody: unknown }
  | { status: 'failed' };

export function createIdempotencyService(repo: IdempotencyRepository) {
  /**
   * Checks an idempotency key and determines what action to take.
   *
   * Returns:
   * - `new`        → INSERT as PROCESSING, caller should execute the handler
   * - `processing` → 409, another request is in flight
   * - `completed`  → replay the stored response
   * - `failed`     → allow retry (same as `new`)
   */
  async function check(key: string, route: string): Promise<Result<IdempotencyCheckResult>> {
    const existing = await repo.findByKey(key);

    if (!existing) {
      // First time: claim the key.
      await repo.createProcessing(key, route);
      return ok({ status: 'new' });
    }

    if (existing.status === 'PROCESSING') {
      return err(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          'A request with this Idempotency-Key is already being processed',
          { key, route },
        ),
      );
    }

    if (existing.status === 'COMPLETED') {
      return ok({
        status: 'completed',
        responseStatus: existing.responseStatus ?? 200,
        responseBody: existing.responseBody,
      });
    }

    // FAILED: allow retry by claiming the key again.
    await repo.createProcessing(key, route);
    return ok({ status: 'new' });
  }

  async function complete(
    key: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> {
    await repo.markCompleted(key, responseStatus, responseBody);
  }

  async function fail(key: string): Promise<void> {
    await repo.markFailed(key);
  }

  async function cleanup(): Promise<number> {
    return repo.deleteExpired();
  }

  return { check, complete, fail, cleanup };
}

export type IdempotencyService = ReturnType<typeof createIdempotencyService>;
