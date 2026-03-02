-- Migration: add_partial_indexes_performance
-- Created: 2026-03-02
-- Purpose: Add partial indexes (WHERE deleted_at IS NULL) for the six models identified
--          in the performance audit (docs/PERFORMANCE.md §4 / §6).
--
-- Prisma DSL does not support WHERE clauses in @@index, so these indexes are managed
-- exclusively via SQL migrations. The schema.prisma is NOT modified.
--
-- These indexes cover only active (non-deleted) records — they are smaller, faster,
-- and match exactly what the soft-delete Prisma extension generates for every read.

-- ─── companies ────────────────────────────────────────────────────────────────
-- Query: WHERE organization_id = $1 AND deleted_at IS NULL [AND id > cursor] ORDER BY id ASC
-- Covers cursor pagination (id > cursor) without post-index filtering on deleted_at.
CREATE INDEX "companies_org_id_active_idx"
  ON "companies" ("organization_id", "id")
  WHERE "deleted_at" IS NULL;

-- ─── echelons ─────────────────────────────────────────────────────────────────
-- Query (no state filter): WHERE organization_id = $1 AND deleted_at IS NULL [AND id > cursor] ORDER BY id ASC
-- The existing echelons_organization_id_state_idx already covers the case with state filter.
-- This index covers the most frequent case: list all echelons for an org.
CREATE INDEX "echelons_org_id_active_idx"
  ON "echelons" ("organization_id", "id")
  WHERE "deleted_at" IS NULL;

-- ─── devices ──────────────────────────────────────────────────────────────────
-- Query: WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC
-- The existing devices_organization_id_idx does not include created_at, forcing an
-- in-memory sort. This index allows an index-only scan with the sort direction.
CREATE INDEX "devices_org_created_active_idx"
  ON "devices" ("organization_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

-- ─── sessions ─────────────────────────────────────────────────────────────────
-- Query: WHERE echelon_id = $1 AND organization_id = $2 AND deleted_at IS NULL ORDER BY session_number ASC
-- The existing sessions_echelon_id_idx + sessions_organization_id_idx are separate;
-- this composite covers the exact join condition used in context-bundle and session list.
CREATE INDEX "sessions_echelon_org_active_idx"
  ON "sessions" ("echelon_id", "organization_id", "session_number" ASC)
  WHERE "deleted_at" IS NULL;

-- ─── required_fields ──────────────────────────────────────────────────────────
-- Query: WHERE echelon_id = $1 AND organization_id = $2 AND deleted_at IS NULL
-- Replaces the two separate single-column indexes for this access pattern.
CREATE INDEX "required_fields_echelon_org_active_idx"
  ON "required_fields" ("echelon_id", "organization_id")
  WHERE "deleted_at" IS NULL;

-- ─── executive_summaries ──────────────────────────────────────────────────────
-- Query (context-bundle): WHERE echelon_id = $1 AND organization_id = $2 AND state = 'VALIDATED' AND deleted_at IS NULL
-- Covers the full filter used by findSummaryIdsBySimilarity and the context-bundle query.
CREATE INDEX "exec_summaries_echelon_state_active_idx"
  ON "executive_summaries" ("echelon_id", "organization_id", "state")
  WHERE "deleted_at" IS NULL;
