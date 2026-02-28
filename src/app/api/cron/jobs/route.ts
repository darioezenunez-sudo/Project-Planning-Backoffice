import type { JobType } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { apiSuccess } from '@/lib/utils/api-response';
import { createJobRepository } from '@/modules/job/job.repository';
import type { JobPayload } from '@/modules/job/job.repository';
import { createJobService } from '@/modules/job/job.service';

// ─── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20;

// ─── Module-level repo/service ─────────────────────────────────────────────────

const repo = createJobRepository();
const service = createJobService(repo);

// ─── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/cron/jobs
 *
 * Triggered by Vercel Cron every 5 minutes (see vercel.json).
 * Picks up to BATCH_SIZE PENDING/FAILED jobs and processes them sequentially.
 *
 * Security: Vercel injects `Authorization: Bearer <CRON_SECRET>` for cron invocations.
 * When CRON_SECRET is set, requests without the correct header are rejected.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify Vercel Cron secret ──────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn({}, 'cron:jobs — unauthorized request rejected');
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Forbidden' } },
        { status: 401 },
      );
    }
  }

  // ── Fetch ready jobs ──────────────────────────────────────────────────────────
  const listResult = await service.listReadyToRun(BATCH_SIZE);
  if (!listResult.ok) {
    logger.error({ err: listResult.error }, 'cron:jobs — failed to list jobs');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch jobs' } },
      { status: 500 },
    );
  }

  const jobs = listResult.value;
  const summary = { processed: 0, failed: 0, skipped: 0, total: jobs.length };

  // ── Process each job sequentially ─────────────────────────────────────────────
  for (const job of jobs) {
    const markResult = await service.markRunning(job.id);
    if (!markResult.ok) {
      logger.warn({ jobId: job.id }, 'cron:jobs — could not mark job as RUNNING, skipping');
      summary.skipped++;
      continue;
    }

    try {
      await dispatchJob(job.type, job.payload);
      await service.markCompleted(job.id);
      summary.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: job.id, type: job.type, err }, 'cron:jobs — job execution failed');
      await service.markFailed(job.id, message);
      summary.failed++;
    }
  }

  logger.info({ ...summary }, 'cron:jobs — batch complete');
  return apiSuccess(summary);
}

// ─── Job dispatchers (stubs — replaced per module in Fase 6+) ──────────────────

async function dispatchJob(type: JobType, payload: JobPayload): Promise<void> {
  switch (type) {
    case 'CONSOLIDATION':
      await processConsolidation(payload);
      break;
    case 'PDF':
      await processPdf(payload);
      break;
    case 'EMAIL':
      await processEmail(payload);
      break;
    case 'BUDGET_ALERT':
      await processBudgetAlert(payload);
      break;
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown job type: ${String(_exhaustive)}`);
    }
  }
}

async function processConsolidation(payload: JobPayload): Promise<void> {
  // TODO Fase 6: wire to AI consolidation service
  logger.info({ echelonId: payload['echelonId'] }, 'CONSOLIDATION job — stub');
  await Promise.resolve();
}

async function processPdf(payload: JobPayload): Promise<void> {
  // TODO Fase 6: wire to PDF adapter
  logger.info({ echelonId: payload['echelonId'] }, 'PDF job — stub');
  await Promise.resolve();
}

async function processEmail(payload: JobPayload): Promise<void> {
  // TODO Fase 6: wire to email adapter (Resend)
  logger.info({ to: payload['to'] }, 'EMAIL job — stub');
  await Promise.resolve();
}

async function processBudgetAlert(payload: JobPayload): Promise<void> {
  // TODO Fase 6: wire to budget alert notification
  logger.info({ organizationId: payload['organizationId'] }, 'BUDGET_ALERT job — stub');
  await Promise.resolve();
}
