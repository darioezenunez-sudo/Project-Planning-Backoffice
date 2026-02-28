# CLAUDE.md — Project-Planning-Backoffice Context Primer

> **Version:** 1.0.0 | **Updated:** 2026-02-28 | **Branch:** feat/fase-5
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

| Layer      | Technology                                | Notes                                                  |
| ---------- | ----------------------------------------- | ------------------------------------------------------ |
| Runtime    | Node 22.22.0 (Volta)                      | pnpm 9.15.9                                            |
| Framework  | Next.js 15.5.10                           | App Router + RSC + Route Handlers                      |
| Language   | TypeScript 5.8.3 strict                   | `noUncheckedIndexedAccess: true`                       |
| ORM        | Prisma 6.8.2                              | Soft-delete extension, optimistic locking              |
| Database   | Supabase PostgreSQL 15                    | + pgvector (768-dim embeddings, HNSW index)            |
| Auth       | Supabase Auth                             | JWT; service-role client bypasses RLS                  |
| Cache      | TanStack Query + Vercel KV                | KV is STUB (always returns null)                       |
| UI         | Shadcn/ui (new-york, zinc)                | **Tailwind v3.4.17 — NEVER upgrade to v4**             |
| i18n       | next-intl                                 | locales: es/en; defaultLocale: es; localePrefix: never |
| State      | Zustand (sidebar) + TanStack Query        | auth-store is STUB                                     |
| LLM        | Vercel AI SDK → OpenAI gpt-4o-mini        | 120K max input tokens                                  |
| Testing    | Vitest v3 (unit) + Playwright v1.52 (E2E) | Coverage threshold: 70%                                |
| CI         | GitHub Actions                            | push/PR to main+develop                                |
| Monitoring | Sentry + Vercel Analytics/SpeedInsights   | DSN pending setup                                      |

---

## 4. Phase Status

| Phase  | Status         | Branch      | Tests |
| ------ | -------------- | ----------- | ----- |
| Fase 0 | ✅ COMPLETE    | main        | 16    |
| Fase 1 | ✅ COMPLETE    | main        | 97    |
| Fase 2 | ✅ COMPLETE    | main        | 173   |
| Fase 3 | ⚠️ PARTIAL     | main        | +57   |
| Fase 4 | ⚠️ PARTIAL     | main        | +3    |
| Fase 5 | 🔄 IN PROGRESS | feat/fase-5 | +E2E  |

**Current branch:** `feat/fase-5` — has unstaged changes in login route, middleware, and E2E tests.

---

## 5. Fase 5 — Current State (2026-02-28)

### Done ✅

- All 13 UI screens built with Shadcn/ui components (in `src/components/screens/`)
- 15 custom hooks in `src/hooks/` — all return **STUB/mock data**
- DashboardShell + sidebar (Zustand collapsed state) + header + breadcrumb layout
- next-intl i18n routing configured (`localePrefix: 'never'`)
- Middleware auth guard (redirect /login if unauthenticated; redirect /dashboard if authenticated)
- E2E smoke + happy-path tests written (`tests/e2e/`)
- Login route handler functional (`src/app/api/v1/auth/login/route.ts`)

### Remaining 🔧

1. **Connect all 15 hooks to real API endpoints** — currently return static mock objects
2. **Implement real auth-store** — `src/stores/auth-store.ts` returns `{ user: null }`
3. **Implement real AuthProvider** — `src/components/providers/auth-provider.tsx` is passthrough
4. **Systematic loading/error/empty states** — per screen, not ad-hoc
5. **`pnpm validate` green** — lint + type-check + 230 unit tests must pass
6. **E2E green end-to-end** — playwright happy-path must complete without mocks
7. **Visual review** — screenshot/audit all screens light + dark mode

---

## 6. Non-Negotiable Rules

1. **Never `throw`** — always `return err(new AppError(...))` — see `src/lib/result.ts`
2. **Never import `prisma` directly in routes** — use repository functions
3. **All types from Zod** — `z.infer<typeof schema>` in `src/schemas/*.schema.ts`
4. **Soft delete only** — never `prisma.entity.delete()` — use `softDeleteData()`
5. **Optimistic locking** — `updateMany({ where: { id, version } })` → count=0 = 409
6. **Middleware chain** — `compose(withAuth, withTenant, withValidation(schema))` for all routes
7. **Tailwind v3.4.17 only** — never `npm upgrade tailwindcss` (breaks Shadcn/ui)
8. **`pnpm validate` before every commit** — `lint + type-check + test:run`
9. **Conventional commits** — `feat(scope):`, `fix(scope):`, `test(scope):` etc. — max 100 chars
10. **No `console.log`** — use `logger` from `@/lib/logger` (Pino, structured JSON)

---

## 7. Key File Map

```
CLAUDE.md                         ← YOU ARE HERE (context primer)
docs/ARCHITECTURE.md              ← API patterns, auth flows, DB design, caching
docs/ENGINEERING_STANDARDS.md     ← Coding rules, patterns, naming conventions
docs/Backoffice-Docs/ROADMAP.md   ← Phase-by-phase roadmap (legacy, still useful)

src/lib/
  env.ts                          ← Env var validation (Zod, fails hard in prod)
  result.ts                       ← Result<T,E>, ok(), err(), isOk(), isErr()
  prisma.ts                       ← Prisma singleton + soft-delete extension
  logger.ts                       ← Pino logger (redacts secrets, injects requestId)
  errors/app-error.ts             ← AppError: code, httpStatus, message, context
  errors/error-codes.ts           ← All ErrorCode values
  middleware/compose.ts            ← compose(...middlewares) for route handlers
  middleware/with-auth.ts         ← Bearer token → Supabase JWT verify
  middleware/with-tenant.ts       ← X-Organization-Id header → RBAC inject
  middleware/with-validation.ts   ← Zod safeParse → 422 with details[]
  supabase/server.ts              ← Service-role client (bypasses RLS) — ADMIN only
  supabase/client.ts              ← Browser client (anon key, respects RLS)
  cache/kv.ts                     ← STUB: kvGet always null, kvSet/kvDel no-op
  ai/provider.ts                  ← OpenAI gpt-4o-mini, generateConsolidationReport()
  utils/pagination.ts             ← cursor pagination, buildCursorPagination()
  utils/api-response.ts           ← apiSuccess(), apiError() response helpers
  pgvector.ts                     ← findSummaryIdsBySimilarity() raw SQL

src/app/api/v1/                   ← All REST handlers
src/components/screens/           ← 15 UI screens
src/components/ui/                ← 24 Shadcn primitives (do not edit)
src/hooks/                        ← 15 data hooks (currently STUB)
src/stores/                       ← Zustand stores (auth-store is STUB)
prisma/schema.prisma              ← Full database schema (source of truth for DB)
.env.example                      ← All env vars documented
```

---

## 8. Environment Variables Status

| Variable                        | Status      | Notes                                          |
| ------------------------------- | ----------- | ---------------------------------------------- |
| `DATABASE_URL`                  | ✅ Required | Supabase pooled connection (PgBouncer)         |
| `DIRECT_URL`                    | ✅ Required | Supabase direct connection (migrations)        |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅ Required | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Required | Supabase anon/public key                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅ Required | Service role key (bypasses RLS)                |
| `OPENAI_API_KEY`                | ✅ Required | For AI consolidation                           |
| `ENCRYPTION_KEY`                | ✅ Required | 32+ bytes for AES-256-GCM                      |
| `SENTRY_DSN`                    | ⚠️ Pending  | Run `pnpm dlx @sentry/wizard@latest -i nextjs` |
| `KV_REST_API_URL`               | ⚠️ Pending  | Vercel KV not yet configured (STUB)            |
| `KV_REST_API_TOKEN`             | ⚠️ Pending  | Vercel KV not yet configured (STUB)            |

---

## 9. Known Technical Debt

| Item                          | File                                                  | Priority                               |
| ----------------------------- | ----------------------------------------------------- | -------------------------------------- |
| auth-store is STUB            | `src/stores/auth-store.ts`                            | 🔴 HIGH — blocks all auth-aware UI     |
| AuthProvider is STUB          | `src/components/providers/auth-provider.tsx`          | 🔴 HIGH — blocks session management    |
| All 15 hooks return mock data | `src/hooks/*.ts`                                      | 🔴 HIGH — Fase 5 core task             |
| KV cache is STUB              | `src/lib/cache/kv.ts`                                 | 🟡 MEDIUM — context bundle won't cache |
| Job queue has no consumer     | `prisma/schema.prisma Job` model                      | 🟡 MEDIUM — deferred to Fase 6         |
| Sentry DSN not configured     | `.env.example`, sentry configs                        | 🟡 MEDIUM — monitoring blind           |
| DB migrations not applied     | `supabase/migrations/`                                | 🔴 HIGH — needs live Supabase          |
| RLS not applied               | `supabase/migrations/20260222000001_rls_policies.sql` | 🔴 HIGH — security gap                 |

---

## 10. Quick Commands

```bash
pnpm validate          # lint + type-check + unit tests (must be green before commit)
pnpm dev               # start dev server
pnpm db:generate       # prisma generate (after schema changes)
pnpm db:migrate        # prisma migrate dev (needs live DB)
pnpm db:seed           # seed with 1 org, 5 users, 2 companies, 3 products
pnpm test              # watch mode
pnpm test:run          # single run (used in CI)
pnpm test:e2e          # playwright E2E
pnpm build             # prisma generate + next build --no-lint
```

---

## 11. Git Strategy

- `main` ← production, protected
- `develop` ← integration, all phases merge here first
- `feat/fase-N` ← current feature branch
- Max ~10 files per commit. Scoped conventional commits.
- Skills: `/new-module` (create domain module), `/phase-commit` (commit a phase)
