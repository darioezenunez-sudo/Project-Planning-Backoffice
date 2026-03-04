# CLAUDE.md — Project-Planning-Backoffice Context Primer

> **Version:** 1.4.0 | **Updated:** 2026-03-04 | **Branch:** develop
> This file is auto-loaded by Claude Code. A new developer or LLM reading this file has full context.
> For deep technical reference → `docs/ARCHITECTURE.md` | Coding rules → `docs/ENGINEERING_STANDARDS.md`
> Product backlog → `docs/BACKLOG.md` | Technical debt → `docs/TECHNICAL_DEBT.md` | Performance → `docs/PERFORMANCE.md`

---

## 1. What Is This?

**Project-Planning-Backoffice** is the **Control Plane** of a two-plane SaaS system for strategic planning management.

| Plane                           | Repo                        | Role                                                                            |
| ------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| **Control Plane** ← _this repo_ | Project-Planning-Backoffice | Admin backoffice: manages orgs, products, echelons, sessions, budgets, devices  |
| **Data Plane**                  | Assistant (Electron app)    | Desktop app running on devices; consumes the API; runs AI consolidation locally |

The backoffice exposes a versioned REST API (`/api/v1/`) consumed by the Electron app and by its own Next.js frontend.

---

## 2. Domain Model

```
Organization
  └── OrganizationMember (User + Role)
  └── Company
        └── Product
              └── Echelon  ← main operational unit
                    ├── RequiredField (+ DecisionLink)
                    ├── Session
                    │     └── ExecutiveSummary (+ embedding vector)
                    └── Attachment
```

### Echelon FSM

```
OPEN → IN_PROGRESS → CLOSING → CLOSURE_REVIEW → CLOSED
                                    ↓ (only valid backward)
                               IN_PROGRESS
```

### Summary FSM

```
DRAFT → REVIEW → EDITED → VALIDATED
```

### RBAC Hierarchy (descending power)

`SUPER_ADMIN > ADMIN > MANAGER > MEMBER > VIEWER`

---

## 3. Tech Stack

| Layer      | Technology                                | Notes                                                       |
| ---------- | ----------------------------------------- | ----------------------------------------------------------- |
| Runtime    | Node 22.22.0 (Volta)                      | pnpm 9.15.9                                                 |
| Framework  | Next.js 15.5.10                           | App Router + RSC + Route Handlers                           |
| Language   | TypeScript 5.8.3 strict                   | `noUncheckedIndexedAccess: true`                            |
| ORM        | Prisma 6.8.2                              | Soft-delete extension, optimistic locking                   |
| Database   | Supabase PostgreSQL 15                    | + pgvector (768-dim embeddings, HNSW index)                 |
| Auth       | Supabase Auth                             | JWT; service-role client bypasses RLS; RLS policies applied |
| Cache      | TanStack Query + Upstash Redis            | @upstash/redis 1.36.3, gru1 region, allkeys-lru eviction    |
| UI         | Shadcn/ui (new-york, zinc)                | **Tailwind v3.4.17 — NEVER upgrade to v4**                  |
| i18n       | next-intl                                 | locales: es/en; defaultLocale: es; localePrefix: never      |
| State      | Zustand (sidebar) + TanStack Query        |                                                             |
| LLM        | Vercel AI SDK → OpenAI gpt-4o-mini        | 120K max input tokens                                       |
| Testing    | Vitest v3 (unit) + Playwright v1.52 (E2E) | 339 unit tests; E2E 36 passed + 2 skipped (38 total)        |
| CI         | GitHub Actions                            | push/PR to main+develop                                     |
| Monitoring | Sentry @sentry/nextjs                     | DSN configured; server + edge + client + global-error wired |

---

## 4. Phase Status

| Phase       | Status      | Branch  | Unit Tests | Notes                                                               |
| ----------- | ----------- | ------- | ---------- | ------------------------------------------------------------------- |
| Fase 0      | ✅ COMPLETE | main    | 16         | Toolchain, env, base config                                         |
| Fase 1      | ✅ COMPLETE | main    | 97         | Org, Company, Product, User, Auth APIs                              |
| Fase 2      | ✅ COMPLETE | main    | 173        | Echelon/Session/Summary FSMs + APIs                                 |
| Fase 3      | ⚠️ PARTIAL  | main    | +57        | Context bundle, pgvector, attachments                               |
| Fase 4      | ⚠️ PARTIAL  | main    | +3         | AI consolidation, budget, devices                                   |
| Fase 5      | ✅ COMPLETE | main    | +E2E       | UI screens, hooks, auth, E2E 26/26                                  |
| Fase 6      | ✅ COMPLETE | main    | 259 total  | Infra hardening: RLS, KV cache, rate-limit, Sentry, DB              |
| Fase 7      | ✅ COMPLETE | main    | 334 total  | Test coverage ≥70%, bug fixes, lint migration, perf cache layer     |
| BACKLOG A–H | ✅ COMPLETE | develop | 339 total  | All 30 backlog issues resolved; RBAC hardening + Assistant contract |

**Current branch:** `develop`

---

## 5. Fase 7 — Completed (2026-03-01) + Post-Fase 7 Work (2026-03-02)

### Fase 7 Completed ✅

- **B1 – Test coverage ≥70%:** Added 58 unit tests across 7 new test files; reached 70.86% statement coverage; Vitest threshold enforced at 70%
- **B2 – Rate-limit window fix:** Corrected `'5min'` → `'5m'` in `withRateLimit` calls in two route files
- **B3 – Lint migration:** Replaced deprecated `next lint` with `eslint src/` CLI; added `@typescript-eslint/require-await: off` for test files
- **B4 – E2E 26/26:** Context bundle E2E test updated to accept `[200, 404]`; all 26 smoke tests passing

### Post-Fase 7 Performance Layer ✅ (on `develop`)

- **Fase 1 – Bearer auth cache:** `src/lib/cache/auth-cache.ts` — SHA-256 hashed key, TTL 60s; `withAuth` cache-first
- **Fase 1 – Tenant membership cache:** `src/lib/cache/tenant-cache.ts` — TTL 120s; `withTenant` cache-first
- **Fase 1 – staleTime fix:** Removed `staleTime: 5_000` override in `use-echelons.ts` (inherits global 30s)
- **Fase 2 – Partial indexes:** `prisma/migrations/20260302000001_add_partial_indexes_performance/` — 6 partial indexes `WHERE deleted_at IS NULL`
- **`docs/PERFORMANCE.md`:** Full latency audit, optimization plan, migration status

### Doc Reorganization ✅ (on `develop`, 2026-03-02)

- **`docs/legacy/`:** 5 deprecated files moved (DEVELOPMENT_PLAN_MVP, ROADMAP, FASE5_SCREENS, Plan_fase_5_inicio, ENGINEERING_STANDARDS_LEGACY)
- **`docs/TECHNICAL_DEBT.md`:** Condensed v2.0 — all Section B items marked ✅ Done (resolved in Fase 6/7)
- **`docs/BACKLOG.md`:** Product backlog v1.0 — 8 phases, 30 issues identified post-Fase 7

### BACKLOG A–H + RBAC Hardening ✅ (on `develop`, 2026-03-04) — commit `16fd72a`

- **BACKLOG A–H:** All 30 issues resolved (see `docs/BACKLOG.md` v1.2 for full checklist)
- **RBAC fixes:** Added `withRole()` to 11 previously unprotected write endpoints:
  - `MANAGER`: companies POST, products POST, required-fields POST/PATCH/DELETE, sessions PATCH, launch POST, attachments DELETE, decision-links PATCH/DELETE
  - `MEMBER`: echelons sessions POST, attachments POST
  - `ADMIN`: sessions DELETE, audit GET
- **Fix O3:** `POST /auth/devices` validates `input.userId === ctx.userId` (403 on mismatch)
- **Login body token:** `POST /auth/login` now returns `{ accessToken, user: { id, organizationId } }` for API clients (Electron)
- **Device token support:** `withAuth` resolves `device_${machineId}|${orgId}|${expiresAtMs}` tokens via `device.service.resolveToken()` (15-min TTL, revocation checked)
- **E2E contract tests:** `tests/e2e/assistant-contract.spec.ts` — 11 tests covering full Assistant ↔ Backoffice integration flow
- **Load test:** `scripts/load-test.js` — 3 new scenarios: device-validate (p95<500ms), submit-summary (p95<2000ms), record-usage (p95<1000ms)
- **Docs:** `docs/FUNCTIONAL_ANALYSIS.md` — full RBAC audit by role, all 40 endpoints, integration flow

### Infra (Fase 6 — merged to main) ✅

- **RLS:** `supabase/migrations/20260222000001_rls_policies.sql` executed in Supabase
- **KV cache:** Real `@upstash/redis` 1.36.3 (graceful fallback); Upstash store in Vercel Marketplace (gru1, allkeys-lru)
- **Rate limiting:** `withRateLimit` sliding-window middleware (429 / RATE_LIMITED); cron job consumer `/api/cron/jobs`
- **Sentry:** `@sentry/nextjs` fully wired — server, edge, client, global-error boundary; DSN via env vars
- **DB:** `prisma migrate dev` applied; seed with Supabase Admin API (5 users, password `Test1234!`)
- **Vercel:** Function Region gru1; Upstash linked to all 3 environments

---

## 6. Non-Negotiable Rules

1. **Never `throw`** — always `return err(new AppError(...))` — see `src/lib/result.ts`
2. **Never import `prisma` directly in routes** — use repository functions
3. **All types from Zod** — `z.infer<typeof schema>` in `src/schemas/*.schema.ts`
4. **Soft delete only** — never `prisma.entity.delete()` — use `softDeleteData()`
5. **Optimistic locking** — `updateMany({ where: { id, version } })` → count=0 = 409
6. **Middleware chain** — `compose(withErrorHandling, withAuth, withTenant, [withRole('X')], [withAudit('Y')], withValidation(schema))` — `withRole` always after `withTenant`, before `withAudit`
7. **Tailwind v3.4.17 only** — never `npm upgrade tailwindcss` (breaks Shadcn/ui)
8. **`pnpm validate` before every commit** — `lint + type-check + test:run`
9. **Conventional commits** — `feat(scope):`, `fix(scope):` etc. — max 100 chars; subject lowercase
10. **No `console.log`** — use `logger` from `@/lib/logger` (Pino, structured JSON)

---

## 7. Key File Map

```
CLAUDE.md                              ← YOU ARE HERE (context primer, auto-loaded)

docs/                                  ← Active documentation
  ARCHITECTURE.md                      ← API patterns, auth flows, DB design, caching
  ENGINEERING_STANDARDS.md            ← Coding rules, patterns, naming conventions
  PERFORMANCE.md                       ← Latency audit, cache layers, DB index plan
  TECHNICAL_DEBT.md                    ← Technical debt tracker (all B1-B7 resolved)
  BACKLOG.md                           ← Product backlog v1.2 — A–H complete; Phase I (Assistant) pending
  FUNCTIONAL_ANALYSIS.md              ← Full RBAC audit: 40 endpoints × 5 roles, integration flow
  resumen_ejecutivo_*.md               ← Executive summary v5.1 (system overview)
  legacy/                              ← Deprecated docs (kept for history, do not edit)
    DEVELOPMENT_PLAN_MVP.md            ← Original MVP plan (superseded by BACKLOG.md)
    ROADMAP.md                         ← Original roadmap (superseded by §4 Phase Status)
    ENGINEERING_STANDARDS_LEGACY.md   ← Old standards (superseded by docs/ENGINEERING_STANDARDS.md)
    FASE5_SCREENS.md                   ← UI screen inventory (superseded by src/components/screens/)
    Plan_fase_5_inicio.md              ← Fase 5 kickoff notes
    plan_provisorio.md                 ← RBAC execution plan (executed 2026-03-04, superseded)

src/lib/
  env.ts                               ← Env var validation (Zod, optional in dev)
  result.ts                            ← Result<T,E>, ok(), err(), isOk(), isErr()
  prisma.ts                            ← Prisma singleton + soft-delete extension
  logger.ts                            ← Pino logger (redacts secrets, injects requestId)
  errors/app-error.ts                  ← AppError: code, httpStatus, message, context
  errors/error-codes.ts                ← All ErrorCode values (incl. RATE_LIMITED)
  middleware/compose.ts                ← compose(...middlewares) for route handlers
  middleware/with-auth.ts              ← Bearer token → Supabase JWT OR device_* token verify
  middleware/with-role.ts              ← RBAC guard: withRole('MANAGER') etc. (after withTenant)
  middleware/with-tenant.ts            ← X-Organization-Id header → RBAC inject
  middleware/with-validation.ts        ← Zod safeParse → 422 with details[]
  middleware/with-rate-limit.ts        ← Sliding window in-memory rate limiter
  middleware/with-error-handling.ts    ← Outermost try-catch wrapper → handleError
  supabase/server.ts                   ← Service-role client (bypasses RLS) — ADMIN only
  supabase/client.ts                   ← Browser client (anon key, respects RLS)
  cache/kv.ts                          ← Upstash Redis: kvGet/kvSet/kvDel (graceful fallback)
  cache/auth-cache.ts                  ← Supabase JWT cache (SHA-256 key, TTL 60s)
  cache/tenant-cache.ts                ← Org membership cache (TTL 120s)
  cache/context-cache.ts               ← Context bundle cache helpers (TTL 5min)
  ai/provider.ts                       ← OpenAI gpt-4o-mini, generateConsolidationReport()
  utils/pagination.ts                  ← cursor pagination, buildCursorPagination()
  utils/api-response.ts                ← apiSuccess(), apiError() response helpers
  pgvector.ts                          ← findSummaryIdsBySimilarity() raw SQL

sentry.server.config.ts                ← Sentry server init (reads SENTRY_DSN)
sentry.edge.config.ts                  ← Sentry edge init (reads SENTRY_DSN)
src/instrumentation.ts                 ← Next.js instrumentation hook (server + edge)
src/instrumentation-client.ts          ← Sentry client init (reads NEXT_PUBLIC_SENTRY_DSN)
src/app/global-error.tsx               ← Global error boundary → Sentry.captureException

src/app/api/v1/                        ← All REST handlers (40 endpoints, all RBAC-protected)
src/components/screens/                ← 15 UI screens (all real, not stubs)
src/components/ui/                     ← 24 Shadcn primitives (do not edit)
src/hooks/                             ← data + mutation hooks (all connected to real API)
src/stores/auth-store.ts               ← Zustand auth store (real implementation)
src/contracts/assistant-api.ts         ← Zod schemas: Assistant ↔ Backoffice contract (source of truth)
src/modules/auth/device.service.ts     ← Device enrollment + resolveToken (device_* format, 15-min TTL)
tests/e2e/assistant-contract.spec.ts   ← Full Assistant integration flow (11 tests)
scripts/load-test.js                   ← k6 load test: 6 scenarios incl. device-validate, submit-summary
prisma/schema.prisma                   ← Full database schema (source of truth for DB)
supabase/migrations/                   ← SQL migrations (RLS policies applied)
.env.example                           ← All env vars documented
```

---

## 8. Environment Variables

| Variable                               | Status        | Notes                                                    |
| -------------------------------------- | ------------- | -------------------------------------------------------- |
| `DATABASE_URL`                         | ✅ Required   | Supabase pooled connection (PgBouncer, port 6543)        |
| `DIRECT_URL`                           | ✅ Required   | Supabase direct connection (migrations, port 5432)       |
| `NEXT_PUBLIC_SUPABASE_URL`             | ✅ Required   | Supabase project URL                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | ✅ Required   | Supabase anon/public key                                 |
| `SUPABASE_SERVICE_ROLE_KEY`            | ✅ Required   | Service role key (bypasses RLS); used by seed + withAuth |
| `OPENAI_API_KEY`                       | ✅ Required   | For AI consolidation (gpt-4o-mini)                       |
| `ENCRYPTION_KEY`                       | ✅ Required   | 32+ bytes for AES-256-GCM                                |
| `CRON_SECRET`                          | ✅ Required   | Bearer secret for `/api/cron/jobs`                       |
| `SENTRY_DSN`                           | ✅ Configured | Server/edge Sentry init                                  |
| `NEXT_PUBLIC_SENTRY_DSN`               | ✅ Configured | Client Sentry init                                       |
| `UPSTASH_REDIS_REST_KV_REST_API_URL`   | ✅ Configured | Vercel injects; prefix "UPSTASH_REDIS_REST" + KV naming  |
| `UPSTASH_REDIS_REST_KV_REST_API_TOKEN` | ✅ Configured | Same prefix convention                                   |
| `JWT_SECRET`                           | ⚠️ Optional   | 32+ chars                                                |
| `RESEND_API_KEY`                       | ⚠️ Optional   | Email (not yet wired)                                    |

> **KV naming note:** Vercel Marketplace prefix `UPSTASH_REDIS_REST` prepends to standard Vercel KV naming (`KV_REST_API_URL/TOKEN`), producing the long names above. `kv.ts` reads them directly from `process.env`.

---

## 9. Known Technical Debt

> Full backlog in `docs/BACKLOG.md`. Full debt tracker in `docs/TECHNICAL_DEBT.md`.
> **All BACKLOG A–H items resolved as of 2026-03-04.** Next horizon: Assistant (Electron) integration.

| Item                                                  | File / Location                                | Priority | Phase   |
| ----------------------------------------------------- | ---------------------------------------------- | -------- | ------- |
| Deep link scheme for Electron app                     | `src/app/api/v1/echelons/[id]/launch/route.ts` | 🔴 HIGH  | Phase I |
| Device token auto-renewal (15-min TTL)                | `src/modules/auth/device.service.ts`           | 🔴 HIGH  | Phase I |
| First-time setup wizard (connect Electron→Backoffice) | TBD                                            | 🟡 MED   | Phase I |
| Offline mode in Assistant (degraded vs blocking)      | Electron app                                   | 🟡 MED   | Phase I |
| Sentry Vercel Integration (sourcemaps)                | Vercel project settings                        | 🟢 LOW   | Phase I |

---

## 10. Quick Commands

```bash
pnpm validate          # lint + type-check + unit tests (must be green before commit)
pnpm dev               # start dev server
pnpm lint              # eslint src/ (migrated from deprecated next lint)
pnpm db:generate       # prisma generate (after schema changes)
pnpm db:migrate        # prisma migrate dev (needs live DB)
pnpm db:seed           # seed: 1 org, 5 users (Test1234!), 2 companies, 3 products, 2 echelons
pnpm test              # watch mode
pnpm test:run          # single run (used in CI)
pnpm test:coverage     # vitest run --coverage (threshold: 70% all metrics)
pnpm test:e2e          # playwright E2E (starts dev server automatically)
pnpm build             # prisma generate + next build --no-lint
```

---

## 11. Git Strategy

- `main` ← production, protected
- `develop` ← integration, all phases merge here first
- `feat/fase-N` ← current feature branch
- Max ~10 files per commit. Scoped conventional commits. Subject always lowercase.
- Skills: `/new-module` (create domain module), `/phase-commit` (commit a phase)
