# CLAUDE.md — Project-Planning-Backoffice Context Primer

> **Version:** 1.2.0 | **Updated:** 2026-03-01 | **Branch:** feat/fase-7
> This file is auto-loaded by Claude Code. A new developer or LLM reading this file has full context.
> For deep technical reference → `docs/ARCHITECTURE.md` | Coding rules → `docs/ENGINEERING_STANDARDS.md`

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
| Testing    | Vitest v3 (unit) + Playwright v1.52 (E2E) | 317 unit tests; E2E 26/26 passing                           |
| CI         | GitHub Actions                            | push/PR to main+develop                                     |
| Monitoring | Sentry @sentry/nextjs                     | DSN configured; server + edge + client + global-error wired |

---

## 4. Phase Status

| Phase  | Status      | Branch      | Unit Tests | Notes                                                  |
| ------ | ----------- | ----------- | ---------- | ------------------------------------------------------ |
| Fase 0 | ✅ COMPLETE | main        | 16         | Toolchain, env, base config                            |
| Fase 1 | ✅ COMPLETE | main        | 97         | Org, Company, Product, User, Auth APIs                 |
| Fase 2 | ✅ COMPLETE | main        | 173        | Echelon/Session/Summary FSMs + APIs                    |
| Fase 3 | ⚠️ PARTIAL  | main        | +57        | Context bundle, pgvector, attachments                  |
| Fase 4 | ⚠️ PARTIAL  | main        | +3         | AI consolidation, budget, devices                      |
| Fase 5 | ✅ COMPLETE | main        | +E2E       | UI screens, hooks, auth, E2E 26/26                     |
| Fase 6 | ✅ COMPLETE | main        | 259 total  | Infra hardening: RLS, KV cache, rate-limit, Sentry, DB |
| Fase 7 | ✅ COMPLETE | feat/fase-7 | 317 total  | Test coverage ≥70%, bug fixes, lint migration (see §5) |

**Current branch:** `feat/fase-7`

---

## 5. Fase 7 — Completed (2026-03-01)

### Completed ✅

- **B1 – Test coverage ≥70%:** Added 58 unit tests across 7 new test files (decision-link, member, with-tenant, with-validation, api-response, pagination, error-handler); reached 70.86% statement coverage; Vitest threshold enforced at 70%
- **B2 – Rate-limit window fix:** Corrected `'5min'` → `'5m'` in `withRateLimit` calls in two route files (`context/[echelonId]/route.ts` and `auth/devices/[machineId]/route.ts`); `parseWindowMs` regex only accepts `s|m|h`
- **B3 – Lint migration:** Replaced deprecated `next lint` with `eslint src/` CLI in `package.json` (both `lint` and `lint:fix`) and `.lintstagedrc.cjs`; added `@typescript-eslint/require-await: off` to test-file ESLint rules; added `prisma/` + `scripts/` to ESLint ignore list
- **B4 – E2E 26/26:** Context bundle E2E test updated to accept `[200, 404]`; all 26 smoke tests passing

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
6. **Middleware chain** — `compose(withErrorHandling, withAuth, withTenant, withValidation(schema))` for all routes
7. **Tailwind v3.4.17 only** — never `npm upgrade tailwindcss` (breaks Shadcn/ui)
8. **`pnpm validate` before every commit** — `lint + type-check + test:run`
9. **Conventional commits** — `feat(scope):`, `fix(scope):` etc. — max 100 chars; subject lowercase
10. **No `console.log`** — use `logger` from `@/lib/logger` (Pino, structured JSON)

---

## 7. Key File Map

```
CLAUDE.md                              ← YOU ARE HERE (context primer)
docs/ARCHITECTURE.md                   ← API patterns, auth flows, DB design, caching
docs/ENGINEERING_STANDARDS.md          ← Coding rules, patterns, naming conventions

src/lib/
  env.ts                               ← Env var validation (Zod, optional in dev)
  result.ts                            ← Result<T,E>, ok(), err(), isOk(), isErr()
  prisma.ts                            ← Prisma singleton + soft-delete extension
  logger.ts                            ← Pino logger (redacts secrets, injects requestId)
  errors/app-error.ts                  ← AppError: code, httpStatus, message, context
  errors/error-codes.ts                ← All ErrorCode values (incl. RATE_LIMITED)
  middleware/compose.ts                ← compose(...middlewares) for route handlers
  middleware/with-auth.ts              ← Bearer token → Supabase JWT verify
  middleware/with-tenant.ts            ← X-Organization-Id header → RBAC inject
  middleware/with-validation.ts        ← Zod safeParse → 422 with details[]
  middleware/with-rate-limit.ts        ← Sliding window in-memory rate limiter
  middleware/with-error-handling.ts    ← Outermost try-catch wrapper → handleError
  supabase/server.ts                   ← Service-role client (bypasses RLS) — ADMIN only
  supabase/client.ts                   ← Browser client (anon key, respects RLS)
  cache/kv.ts                          ← Upstash Redis: kvGet/kvSet/kvDel (graceful fallback)
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

src/app/api/v1/                        ← All REST handlers
src/components/screens/                ← 15 UI screens (all real, not stubs)
src/components/ui/                     ← 24 Shadcn primitives (do not edit)
src/hooks/                             ← 15 data hooks (all connected to real API)
src/stores/auth-store.ts               ← Zustand auth store (real implementation)
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

| Item                                 | File / Location         | Priority                                                               |
| ------------------------------------ | ----------------------- | ---------------------------------------------------------------------- |
| Sentry Vercel Integration (optional) | Vercel project settings | 🟢 LOW — dashboard-only; add `SENTRY_AUTH_TOKEN` for deploy sourcemaps |

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
