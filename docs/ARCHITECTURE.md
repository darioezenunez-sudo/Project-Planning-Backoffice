# ARCHITECTURE.md — Project-Planning-Backoffice Technical Reference

> **Version:** 1.0.0 | **Updated:** 2026-02-28
> Quick context → `CLAUDE.md` | Coding rules → `docs/ENGINEERING_STANDARDS.md`

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE (this repo)                    │
│                     Project-Planning-Backoffice                      │
│                                                                     │
│  Next.js 15 (App Router)                                            │
│  ┌──────────────┐   ┌──────────────────────────────────────┐        │
│  │  Frontend    │   │  REST API /api/v1/                   │        │
│  │  React RSC   │   │  Route Handlers + Middleware Chain   │        │
│  └──────────────┘   └──────────────┬─────────────────────┘        │
│                                    │                                │
│  ┌────────────────────────────────▼─────────────────────────────┐  │
│  │  Services → Repositories → Prisma → Supabase PostgreSQL 15   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌────────────┐  ┌─────────────────────────┐ │
│  │  Supabase Auth   │  │ Vercel KV  │  │  OpenAI gpt-4o-mini     │ │
│  │  (JWT)           │  │  (STUB)    │  │  (AI consolidation)     │ │
│  └──────────────────┘  └────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
              ↕  REST API + JWT
┌─────────────────────────────────────────────────────────────────────┐
│              DATA PLANE — Assistant (Electron app)                  │
│  Device-local AI + Session recording + Summary upload               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. API Design

### Request/Response Format

Every route handler returns a consistent JSON envelope:

```ts
// Success
{ data: T, meta?: { pagination?: PaginationMeta } }

// Error
{ error: { code: ErrorCode, message: string, requestId?: string, details?: FieldError[] } }
```

`apiSuccess<T>(data, meta?, status?)` and `apiError(code, message, status, requestId?, details?)` helpers live in `src/lib/utils/api-response.ts`.

### Middleware Chain

All protected routes use `compose()` from `src/lib/middleware/compose.ts`:

```ts
// Typical protected route
export const POST = compose(
  withAuth, // 1. Verify Bearer JWT → inject userId
  withTenant, // 2. Verify X-Organization-Id → inject orgId + role
  withValidation(schema), // 3. Zod safeParse body/query → 422 on failure
)(async (req, ctx) => {
  // ctx.userId, ctx.organizationId, ctx.role always defined here
});
```

`compose()` is a `reduceRight` — middlewares wrap from right to left, execute left to right.

### Validation Errors (422)

When Zod validation fails, `withValidation` returns:

```json
{
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Validation failed",
    "details": [{ "field": "name", "message": "Required" }]
  }
}
```

### Idempotency

Routes that create resources support `Idempotency-Key: <uuid>` header:

- First request: processes and stores result in `idempotency_keys` table (24h TTL)
- Duplicate request with same key: returns cached result immediately (no re-processing)
- Lifecycle: `PROCESSING → COMPLETED | FAILED`
- Table has `(organization_id, key)` unique constraint

### Pagination

All list endpoints use cursor-based pagination (not offset):

```ts
// Request: GET /api/v1/companies?limit=20&cursor=<base64url-encoded-uuid>
// Response:
{
  "data": [...],
  "meta": {
    "pagination": {
      "nextCursor": "<base64url>",  // null if no more pages
      "hasMore": true,
      "limit": 20
    }
  }
}
```

`encodeCursor()` / `decodeCursor()` in `src/lib/utils/pagination.ts`. DEFAULT_LIMIT=20, MAX_LIMIT=100.

---

## 3. Authentication Flows

### Browser Session (Frontend)

```
1. User POST /api/v1/auth/login { email, password }
2. Server calls supabase.auth.signInWithPassword()
3. Supabase sets httpOnly cookies (sb-access-token, sb-refresh-token)
4. middleware.ts runs updateSession() on every request → refreshes JWT in cookies
5. Auth guard in middleware.ts: no session → redirect /login
```

### API Authentication (Electron App)

```
1. Device calls POST /api/v1/auth/login → receives JWT in response body
2. Every subsequent request: Authorization: Bearer <jwt>
3. withAuth middleware calls supabase.auth.getUser(token) → extracts userId
4. withTenant reads X-Organization-Id header → verifies membership + injects role
```

### Supabase Client Types

| Client               | File                             | Key                             | RLS                 |
| -------------------- | -------------------------------- | ------------------------------- | ------------------- |
| Service-role (admin) | `src/lib/supabase/server.ts`     | `SUPABASE_SERVICE_ROLE_KEY`     | Bypassed            |
| Browser              | `src/lib/supabase/client.ts`     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enforced            |
| Middleware (Edge)    | `src/lib/supabase/middleware.ts` | anon key                        | Cookie refresh only |

> ⚠️ `server.ts` is named "server" but uses `@supabase/supabase-js` createClient (admin).
> The `@supabase/ssr` createServerClient is only used in middleware.ts for cookie refresh.

---

## 4. Key Data Flows

### Device Enrollment

```
Electron App → POST /api/v1/devices { serialNumber, model, ... }
  → withAuth → withTenant(ADMIN)
  → DeviceService.enroll()
  → Create Device record (PENDING_ACTIVATION)
  → Return { deviceId, activationCode }
  → Admin approves in backoffice UI → Device status: ACTIVE
  → Electron app polls /api/v1/devices/:id/status → detects ACTIVE → starts session
```

### Launch Assistant (Session Creation)

```
Electron App → POST /api/v1/echelons/:id/sessions
  → withAuth → withTenant(MANAGER+)
  → Verify Echelon FSM: must be OPEN or IN_PROGRESS
  → Transition Echelon: OPEN → IN_PROGRESS (if needed)
  → Create Session { echelonId, deviceId, userId }
  → Return { sessionId }
  → Electron runs local LLM analysis
  → POST /api/v1/sessions/:id/summary with ExecutiveSummary text
  → Summary starts at DRAFT state
```

### Session Lifecycle & Consolidation

```
Summary DRAFT → REVIEW (human review in backoffice)
             → EDITED (corrections made)
             → VALIDATED (approved)

When all required summaries are VALIDATED:
  POST /api/v1/echelons/:id/consolidate
  → Build context bundle (echelon + requiredFields + VALIDATED summaries + decisionLinks)
  → KV cache key: ctx:{echelonId} TTL 300s
  → pgvector similarity search: find top-K summaries by embedding cosine distance
  → generateConsolidationReport() → OpenAI gpt-4o-mini structured output
  → Store result
  → Echelon: IN_PROGRESS → CLOSING
```

### GET /context/:echelonId — Ranked retrieval (H5)

The Assistant (Electron app) can request the context bundle with an optional **query embedding** to get summaries ordered by similarity to the query (pgvector cosine distance):

- **Without query param:** `GET /api/v1/context/:echelonId` — bundle built with default order (VALIDATED first, then by `createdAt`). Response is cached (KV key `ctx:{echelonId}`, TTL 5 min).
- **With query param:** `GET /api/v1/context/:echelonId?queryEmbedding=<base64url>` — `queryEmbedding` is `base64url(JSON.stringify(number[768]))`. The API calls `findSummaryIdsBySimilarity()` and returns summaries in that order (nearest first). Cache is **not** used (result is query-dependent).

Contract: `src/contracts/assistant-api.ts` — `CONTEXT_QUERY_EMBEDDING_DIMS = 768`, `contextQueryEmbeddingSchema`.

---

## 5. Database Design

### Standard Columns (all entities except AuditLog, HealthCheck)

```prisma
id          String    @id @default(uuid())
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
deletedAt   DateTime? // null = active; soft delete pattern
version     Int       @default(1) // optimistic locking
```

### Soft Delete

Prisma extension in `src/lib/prisma.ts` auto-filters `deletedAt: null` for all `findMany`, `findFirst`, `findUnique`, `count` on models in `SOFT_DELETE_MODELS`.

```ts
// Never do this:
await prisma.company.delete({ where: { id } });

// Always do this:
await prisma.company.updateMany({
  where: { id, organizationId, version },
  data: softDeleteData(), // returns { deletedAt: new Date(), version: { increment: 1 } }
});
```

### Optimistic Locking

```ts
const count = await prisma.echelon.updateMany({
  where: { id, organizationId, version: expectedVersion },
  data: { name: newName, version: { increment: 1 } },
});
if (count.count === 0) return err(new AppError('CONFLICT', 409, 'Version conflict'));
```

### Key Indexes

- `(organization_id, deleted_at)` — multi-tenant soft-delete queries
- `(echelon_id, status)` — FSM-filtered queries
- `executive_summaries.embedding` — HNSW index (cosine) for pgvector similarity

### pgvector

Embeddings are 768-dimensional vectors stored in `executive_summaries.embedding` column (type `Unsupported("vector(768)")`). Similarity search uses cosine distance operator `<=>`:

```sql
SELECT id FROM executive_summaries
WHERE echelon_id = $1 AND organization_id = $2 AND deleted_at IS NULL AND embedding IS NOT NULL
ORDER BY embedding <=> $3::vector
LIMIT $4
```

Called via `prisma.$queryRawUnsafe()` in `src/lib/pgvector.ts` — Prisma does not support vector natively.

---

## 6. Caching Strategy (4 Layers)

```
Request
  │
  ▼
TanStack Query (browser)       staleTime: 30s, browser-only
  │  cache miss
  ▼
Vercel Edge ISR                route-level revalidation via CACHE_TAGS
  │  cache miss
  ▼
Vercel KV                      ctx:{echelonId} TTL 300s ← STUB (always miss)
  │  cache miss
  ▼
Prisma → PgBouncer → Supabase  source of truth
```

**KV is currently STUB** — `kvGet()` always returns `null`, `kvSet()`/`kvDel()` are no-ops. Implement by replacing `src/lib/cache/kv.ts` with real `@vercel/kv` calls and setting `KV_REST_API_URL` + `KV_REST_API_TOKEN`.

**Cache invalidation:** After a summary is VALIDATED, `invalidateContextCacheIfValidated()` in `src/lib/cache/context-cache.ts` calls `kvDel('ctx:{echelonId}')`.

---

## 7. LLM Consolidation Flow

```
src/lib/ai/provider.ts

generateConsolidationReport(echelonId, organizationId, query?)
  │
  ├─ Build context bundle:
  │    echelon metadata
  │  + requiredFields (+ decisionLinks)
  │  + VALIDATED ExecutiveSummaries (optionally sorted by pgvector similarity)
  │
  ├─ Truncate to CONSOLIDATION_MAX_INPUT_TOKENS = 120,000
  │
  ├─ Call OpenAI gpt-4o-mini with structured output (Zod schema)
  │
  └─ Return ConsolidationReport { summary, keyDecisions, risks, recommendations }
```

Provider created via `createOpenAI({ apiKey: env.OPENAI_API_KEY })` from `@ai-sdk/openai`. Model: `DEFAULT_MODEL = 'gpt-4o-mini'`.

---

## 8. Job Queue

```prisma
model Job {
  id          String    @id @default(uuid())
  type        String    // e.g. "CONSOLIDATION", "DEVICE_SYNC"
  payload     Json
  status      JobStatus // PENDING | RUNNING | COMPLETED | FAILED | DEAD_LETTER
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  runAt       DateTime  @default(now())
  // ... standard columns
}
```

**There is no consumer yet.** Jobs accumulate in the table but are never picked up. Implementing a Vercel Cron or edge worker to process them is deferred to Fase 6.

---

## 9. Frontend Architecture

### Provider Stack (root layout)

```tsx
NextIntlClientProvider
  └── ThemeProvider (next-themes, defaultTheme="dark")
        └── QueryProvider (TanStack Query, staleTime: 30s)
              └── AuthProvider ← STUB (passthrough)
                    └── {children}
                          Toaster (Sonner)
Analytics + SpeedInsights (outside providers)
```

### Route Groups

```
src/app/
  (auth)/           ← login page group, no sidebar
    layout.tsx      ← min-h-screen flex items-center justify-center
  (dashboard)/      ← protected pages group
    layout.tsx      ← renders <DashboardShell>{children}</DashboardShell>
  api/v1/           ← REST handlers (excluded from next-intl + auth guard)
```

### Hooks → API Pattern (target state after Fase 5)

```ts
// src/hooks/use-companies.ts
export function useCompanies() {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: ['companies', organizationId],
    queryFn: () =>
      fetch(`/api/v1/companies`, { headers: { 'X-Organization-Id': organizationId } }).then((r) =>
        r.json(),
      ),
    enabled: !!organizationId,
  });
}
```

Currently all hooks return static mock objects — connecting them to real endpoints is the core Fase 5 task.

### i18n

- `localePrefix: 'never'` — URL never contains `/es/` or `/en/` prefix
- Locale detected from cookies → headers → default 'es'
- Messages in `src/i18n/messages/es.json` and `en.json`
- Server components use `getTranslations()` (async), client components use `useTranslations()`
- `createNextIntlPlugin` in `next.config.ts` (NOT middleware — would rewrite URLs causing 404s)

---

## 10. Security Architecture

### Headers (next.config.ts)

- `Content-Security-Policy` — strict, Sentry + Vercel only
- `Strict-Transport-Security` — `max-age=31536000; includeSubDomains`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Data Protection

- Secrets redacted in logs: `password, token, apiKey, api_key, secret, authorization, cookie`
- AES-256-GCM encryption for sensitive fields: `src/lib/utils/crypto.ts` format `base64(iv):base64(authTag):base64(ciphertext)`
- HKDF derivation if `ENCRYPTION_KEY` not exactly 32 bytes
- `AsyncLocalStorage` carries `requestId, userId, organizationId, role` — injected into every log line

### RLS

Supabase RLS policies defined in `supabase/migrations/20260222000001_rls_policies.sql` — **not yet applied** to production. Browser client (`anon` key) will respect RLS once applied. Service-role client always bypasses.

---

## 11. Frontend Realtime (Supabase Postgres Changes)

When multiple users work in the same organization, the UI can stay in sync without refresh by subscribing to Supabase Realtime **postgres_changes** for `echelons` and `sessions`.

**Implementation:**

- `src/hooks/use-realtime-invalidation.ts` — subscribes to `echelons` and `sessions` with filter `organization_id=eq.{orgId}`; on any event, invalidates the relevant TanStack Query keys so lists and details refetch.
- `src/components/providers/realtime-provider.tsx` — mounts inside the dashboard layout and runs the subscription when `organizationId` is set.

**Supabase Dashboard (required):**

1. **Database** → **Replication** (or **Publications**).
2. Under publication `supabase_realtime`, add tables **echelons** and **sessions** (or run `ALTER PUBLICATION supabase_realtime ADD TABLE echelons, sessions;`).

RLS applies to Realtime: the anon key must have `SELECT` (and appropriate policies) on these tables for the subscription to receive events. If RLS blocks the subscription, no events are delivered.
