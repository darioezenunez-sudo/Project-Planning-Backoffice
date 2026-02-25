-- CreateEnum (JobType, JobStatus) — Fase 4 job queue
CREATE TYPE "JobType" AS ENUM ('CONSOLIDATION', 'PDF', 'EMAIL', 'BUDGET_ALERT');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- Echelon: consolidated report from AI consolidation engine
ALTER TABLE "echelons" ADD COLUMN IF NOT EXISTS "consolidated_report" JSONB;
ALTER TABLE "echelons" ADD COLUMN IF NOT EXISTS "consolidated_at" TIMESTAMP(3);

-- Jobs table for async work (pg_net invokes Edge Functions)
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "jobs_status_scheduled_at_idx" ON "jobs"("status", "scheduled_at");
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");
