-- Enable pgvector extension (required before any vector column is used)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER');
-- CreateEnum
CREATE TYPE "EchelonState" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSING', 'CLOSURE_REVIEW', 'CLOSED');
-- CreateEnum
CREATE TYPE "SummaryState" AS ENUM ('DRAFT', 'REVIEW', 'EDITED', 'VALIDATED');
-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'TRANSITION', 'LOGIN', 'LOGOUT', 'DEVICE_ENROLLED', 'DEVICE_REVOKED', 'INVITE_SENT', 'INVITE_ACCEPTED');
-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('CONSOLIDATION', 'PDF', 'EMAIL', 'BUDGET_ALERT');
-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');
-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "echelons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "EchelonState" NOT NULL DEFAULT 'OPEN',
    "config_blueprint" JSONB,
    "consolidated_report" JSONB,
    "consolidated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "echelons_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "required_fields" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "echelon_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "is_met" BOOLEAN NOT NULL DEFAULT false,
    "met_at" TIMESTAMP(3),
    "met_by_user_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "required_fields_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "decision_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "required_field_id" TEXT,
    "executive_summary_id" TEXT,
    "label" TEXT NOT NULL,
    "link_url" TEXT,
    "link_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "decision_links_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "echelon_id" TEXT NOT NULL,
    "session_number" INTEGER NOT NULL,
    "conducted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "executive_summaries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "echelon_id" TEXT NOT NULL,
    "state" "SummaryState" NOT NULL DEFAULT 'DRAFT',
    "raw_content" TEXT,
    "edited_content" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "edited_at" TIMESTAMP(3),
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "embedding" vector(768),
    CONSTRAINT "executive_summaries_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "executive_summary_id" TEXT,
    "echelon_id" TEXT,
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "os_info" JSONB,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT,
    "echelon_id" TEXT,
    "month_year" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_id" TEXT,
    "actor_email" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "diff" JSONB,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "health_checks" (
    "id" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id")
);
-- CreateTable
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
-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");
-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");
-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");
-- CreateIndex
CREATE INDEX "companies_organization_id_idx" ON "companies"("organization_id");
-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");
-- CreateIndex
CREATE INDEX "products_company_id_idx" ON "products"("company_id");
-- CreateIndex
CREATE INDEX "echelons_organization_id_state_idx" ON "echelons"("organization_id", "state");
-- CreateIndex
CREATE INDEX "echelons_product_id_idx" ON "echelons"("product_id");
-- CreateIndex
CREATE INDEX "required_fields_echelon_id_idx" ON "required_fields"("echelon_id");
-- CreateIndex
CREATE INDEX "required_fields_organization_id_idx" ON "required_fields"("organization_id");
-- CreateIndex
CREATE INDEX "decision_links_required_field_id_idx" ON "decision_links"("required_field_id");
-- CreateIndex
CREATE INDEX "decision_links_executive_summary_id_idx" ON "decision_links"("executive_summary_id");
-- CreateIndex
CREATE INDEX "decision_links_organization_id_idx" ON "decision_links"("organization_id");
-- CreateIndex
CREATE INDEX "sessions_echelon_id_idx" ON "sessions"("echelon_id");
-- CreateIndex
CREATE INDEX "sessions_organization_id_idx" ON "sessions"("organization_id");
-- CreateIndex
CREATE INDEX "executive_summaries_session_id_state_idx" ON "executive_summaries"("session_id", "state");
-- CreateIndex
CREATE INDEX "executive_summaries_echelon_id_idx" ON "executive_summaries"("echelon_id");
-- CreateIndex
CREATE INDEX "executive_summaries_organization_id_idx" ON "executive_summaries"("organization_id");
-- CreateIndex
CREATE INDEX "attachments_executive_summary_id_idx" ON "attachments"("executive_summary_id");
-- CreateIndex
CREATE INDEX "attachments_echelon_id_idx" ON "attachments"("echelon_id");
-- CreateIndex
CREATE INDEX "attachments_organization_id_idx" ON "attachments"("organization_id");
-- CreateIndex
CREATE INDEX "devices_machine_id_user_id_idx" ON "devices"("machine_id", "user_id");
-- CreateIndex
CREATE INDEX "devices_organization_id_idx" ON "devices"("organization_id");
-- CreateIndex
CREATE UNIQUE INDEX "devices_organization_id_machine_id_key" ON "devices"("organization_id", "machine_id");
-- CreateIndex
CREATE INDEX "usage_records_organization_id_month_year_idx" ON "usage_records"("organization_id", "month_year");
-- CreateIndex
CREATE INDEX "usage_records_echelon_id_idx" ON "usage_records"("echelon_id");
-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");
-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");
-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");
-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
-- CreateIndex
CREATE INDEX "jobs_status_scheduled_at_idx" ON "jobs"("status", "scheduled_at");
-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");
-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "echelons" ADD CONSTRAINT "echelons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "required_fields" ADD CONSTRAINT "required_fields_echelon_id_fkey" FOREIGN KEY ("echelon_id") REFERENCES "echelons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_required_field_id_fkey" FOREIGN KEY ("required_field_id") REFERENCES "required_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_executive_summary_id_fkey" FOREIGN KEY ("executive_summary_id") REFERENCES "executive_summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_echelon_id_fkey" FOREIGN KEY ("echelon_id") REFERENCES "echelons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "executive_summaries" ADD CONSTRAINT "executive_summaries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_executive_summary_id_fkey" FOREIGN KEY ("executive_summary_id") REFERENCES "executive_summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_echelon_id_fkey" FOREIGN KEY ("echelon_id") REFERENCES "echelons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_echelon_id_fkey" FOREIGN KEY ("echelon_id") REFERENCES "echelons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (pgvector HNSW for cosine similarity on executive_summaries.embedding)
CREATE INDEX IF NOT EXISTS "idx_summaries_embedding"
ON "executive_summaries"
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
