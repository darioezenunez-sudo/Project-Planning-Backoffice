> ⚠️ **ARCHIVO LEGACY** (2026-02-28) — Contiene el plan técnico completo original. Útil como referencia de capas transversales y estructura de módulos planificada.
> Para contexto de proyecto actualizado → `CLAUDE.md` (raíz del proyecto)
> Para arquitectura técnica → `docs/ARCHITECTURE.md`

# Plan de Desarrollo End-to-End — MVP Backoffice (Control Plane)

**Versión:** 2.1 · **Fecha:** 2026-02-21 · **Estado:** Activo — Fase 0 en progreso
**Scope:** Backoffice Control Plane + Web Admin. El Assistant (Data Plane) NO se modifica en este plan; se definen contratos de integración.

---

## Stack Consolidado

| Capa                | Tecnología                                                                             | Versión confirmada                                                           | Justificación                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Runtime**         | Node.js 22 LTS + TypeScript 5.x (strict mode)                                          | Node 22.22.0 · TS 5.8.3                                                      | Node 22: estable en Vercel, soporte LTS activo. TS strict elimina clases enteras de bugs.                                               |
| **Framework**       | Next.js 15 (App Router, RSC, Server Actions, Streaming)                                | **15.5.10** ⬆ (upgrade desde 15.3.3 — 10 CVEs críticos/high)                 | Monorepo: frontend SSR/RSC + API Route Handlers. Vercel-native.                                                                         |
| **API**             | Next.js Route Handlers (`app/api/v1/...`) + Server Actions para mutations del frontend | —                                                                            | Serverless en Vercel. Capa de services/repos agnóstica al transport.                                                                    |
| **ORM**             | Prisma 6.x                                                                             | 6.8.2                                                                        | Type-safe, schema as source of truth, migrations declarativas. ⚠️ Prisma 7 disponible — migrar post-MVP (breaking: prisma config file). |
| **Base de datos**   | PostgreSQL 15 (Supabase Free Tier, 500MB)                                              | —                                                                            | RLS nativo, pgvector para embeddings.                                                                                                   |
| **Auth**            | Supabase Auth (JWT + RLS)                                                              | @supabase/ssr 0.6.x · @supabase/supabase-js 2.49.x                           | 50K MAU gratis. `createServerClient` desde `@supabase/ssr`, `createClient` desde `@supabase/supabase-js` para service role.             |
| **Storage**         | Supabase Storage (1GB gratis)                                                          | —                                                                            | Reemplaza S3 en MVP. Buckets con policies por tenant.                                                                                   |
| **Job Queue**       | Supabase Edge Functions + Database Webhooks + pg_net (HTTP from SQL)                   | —                                                                            | Workers async para PDF gen, emails. Sin Redis.                                                                                          |
| **LLM Integration** | Vercel AI SDK 5 (`ai` package)                                                         | —                                                                            | Provider-agnostic. `generateObject()` con Zod schemas. Token tracking built-in. Streaming.                                              |
| **Email**           | Resend Free Tier (100 emails/día) + React Email                                        | —                                                                            | API-first, TypeScript SDK. Templates como componentes React.                                                                            |
| **PDF Generation**  | @react-pdf/renderer (Supabase Edge Function)                                           | —                                                                            | Genera PDF desde templates TypeScript.                                                                                                  |
| **UI Components**   | Shadcn/ui + **Tailwind CSS 3.x** + Radix primitives                                    | Tailwind 3.4.17 (**v3, no v4**)                                              | v4 inestable con Shadcn/ui al momento de setup. Actualizar a v4 cuando Shadcn soporte estable. darkMode: 'class' configurado.           |
| **State (client)**  | Zustand (global) + React Context (scoped)                                              | Lightweight. Sin Redux overhead.                                             |
| **Data Fetching**   | TanStack Query v5 (React Query)                                                        | Cache, revalidation, optimistic updates, stale-while-revalidate.             |
| **Forms**           | React Hook Form + Zod                                                                  | Validación type-safe. Zod schemas compartidos API ↔ Frontend.                |
| **Realtime**        | Supabase Realtime (Postgres Changes)                                                   | Push updates al frontend cuando Assistant envía datos.                       |
| **Rate Limiting**   | Vercel WAF (dashboard) + `@upstash/ratelimit` (code-level)                             | WAF para DDoS básico. Upstash para rate limit granular por endpoint/user/IP. |
| **Caching**         | Vercel KV (30K req/mes free) + Next.js ISR + `unstable_cache`                          | Multi-layer: HTTP cache (ISR) → application cache (KV) → DB.                 |
| **Monitoring**      | Vercel Analytics + Speed Insights (free) + Sentry (free tier)                          | RUM, Core Web Vitals, error tracking con source maps.                        |
| **Testing**         | Vitest (unit/integration) + Playwright (E2E) + Testing Library (components)            | 70-80% coverage target.                                                      |
| **CI/CD**           | GitHub Actions                                                                         | Lint → Type-check → Test → Build → Deploy.                                   |
| **Deploy**          | Vercel (frontend + API) + Supabase (DB + Auth + Storage + Edge Functions)              | $0/mes en free tier.                                                         |
| **UI Prototyping**  | Vercel v0.dev                                                                          | Genera componentes Shadcn/ui desde prompts. Acelera Fase 5.                  |

---

## Capas Transversales de Ingeniería

Estas secciones definen los estándares que se aplican **a todo el código desde el día 1**. No son tareas de una fase — son constraints de calidad que cada línea de código debe cumplir.

### T.1 — Design Patterns

| Patrón                     | Dónde aplica                                  | Implementación                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository Pattern**     | Toda persistencia                             | Cada módulo tiene `*.repository.ts`. El service nunca habla con Prisma directo. Permite mock en tests, permite cambiar ORM sin tocar lógica.                                                                                                               |
| **Service Layer**          | Toda lógica de negocio                        | `*.service.ts` contiene reglas de dominio. Implementación: **factory de funciones** que devuelven un objeto de métodos; deps inyectadas por parámetro. Sin clases para dominio. Sin side effects de I/O directo — delega a repositories, external clients. |
| **Result Pattern**         | Todo error handling                           | `Result<T, E>` como tipo de retorno. Errores como valores, no excepciones. El caller está obligado a manejar ambos paths. No hay `try-catch` disperso.                                                                                                     |
| **Middleware Composition** | Route Handlers                                | `withAuth`, `withTenant`, `withValidation`, `withRateLimit`, `withErrorHandling` — composables. Un handler se arma por composición de middlewares, no por herencia.                                                                                        |
| **State Machine**          | Echelon, ExecutiveSummary                     | FSM pura: `transition(state, event) → Result<newState, TransitionError>`. Sin side effects. Los side effects se ejecutan después de la transición exitosa.                                                                                                 |
| **Factory Pattern**        | Tests + Seed data                             | `createCompanyFactory()`, `createEchelonFactory()`. Factories con overrides parciales. Consistencia en test data.                                                                                                                                          |
| **Singleton**              | Prisma client, Supabase client, DI container  | Una instancia por proceso. En serverless cada invocación tiene su propio proceso, pero dentro de una invocación no se recrean clientes.                                                                                                                    |
| **Strategy Pattern**       | Integration triggers, LLM provider selection  | `IntegrationStrategy` interface con implementaciones por tipo de eslabón (PM, Arquitectura, UX). Extensible sin modificar el engine.                                                                                                                       |
| **Observer/Event Emitter** | Cross-cutting concerns (audit, notifications) | Domain events: `EchelonClosed`, `SummaryValidated`, `DeviceEnrolled`. Listeners registrados en DI setup. Desacoplamiento entre módulos.                                                                                                                    |
| **Adapter Pattern**        | External services (Resend, LLM, Storage)      | `EmailPort` interface → `ResendAdapter` implementation. Si cambiás de Resend a SendGrid, cambiás solo el adapter.                                                                                                                                          |

### T.2 — API Design Standards

```
Toda API route sigue este contrato:
```

**Request/Response format:**

```typescript
// Success
{ "data": T, "meta": { "pagination"?: CursorPagination, "timestamp": ISO8601 } }

// Error
{ "error": { "code": "ECHELON_INVALID_TRANSITION", "message": string, "details"?: unknown }, "meta": { "requestId": string, "timestamp": ISO8601 } }
```

**Versionado:** Prefix `/api/v1/`. Breaking changes → `/api/v2/`. Non-breaking additions (new fields) no incrementan versión.

**Naming conventions:**

- Recursos en plural: `/companies`, `/echelons`, `/sessions`
- Sub-recursos anidados: `/echelons/:id/sessions`
- Acciones como sub-recurso POST: `/echelons/:id/consolidate`, `/echelons/:id/close`
- Query params para filtros: `?state=IN_PROGRESS&companyId=xxx`
- Cursor-based pagination: `?cursor=xxx&limit=20`

**HTTP Methods + Idempotency:**

| Method | Idempotente                                   | Uso                              | Cache                           |
| ------ | --------------------------------------------- | -------------------------------- | ------------------------------- |
| GET    | Sí                                            | Lectura. Sin side effects.       | Cacheable (Cache-Control, ETag) |
| POST   | **No por defecto → Sí con `Idempotency-Key`** | Crear recurso o disparar acción. | No cacheable                    |
| PUT    | Sí                                            | Reemplazo completo del recurso   | No cacheable                    |
| PATCH  | Sí                                            | Actualización parcial            | No cacheable                    |
| DELETE | Sí                                            | Soft delete (flag `deleted_at`)  | No cacheable                    |

**Idempotency Key (para POST críticos):**

```
Header: Idempotency-Key: <client-generated-uuid>
```

El servidor almacena el resultado de la primera ejecución (en tabla `idempotency_keys` con TTL 24h). Si el mismo key llega de nuevo, retorna el resultado almacenado sin re-ejecutar. Aplica a:

- `POST /sessions/:id/summary` (el Assistant puede reintentar si hay timeout)
- `POST /usage` (evita duplicar registros de uso)
- `POST /echelons/:id/consolidate` (evita doble consolidación)
- `POST /auth/devices` (evita doble enrollment)

**Request ID:**
Cada request genera un `requestId` (UUID v7 — timestamp-ordered). Se propaga en:

- Response header: `X-Request-Id`
- Logs (structured)
- Error responses
- Audit trail

### T.3 — Rate Limiting Strategy

**Capa 1 — Vercel WAF (infrastructure level):**

- Configurar en Vercel Dashboard → Firewall → Rate Limiting
- Default: 100 req/min por IP para todas las rutas
- Aggressive: 20 req/min para `/api/v1/auth/*` (prevenir brute force)

**Capa 2 — Application-level (`@upstash/ratelimit`):**

| Endpoint category                    | Algorithm      | Limit                        | Window | Key       |
| ------------------------------------ | -------------- | ---------------------------- | ------ | --------- |
| Auth (login, register)               | Fixed Window   | 5 req                        | 15 min | IP        |
| Device enrollment                    | Fixed Window   | 3 req                        | 1 hora | userId    |
| Read endpoints (GET)                 | Sliding Window | 100 req                      | 1 min  | userId    |
| Write endpoints (POST/PUT/PATCH)     | Sliding Window | 30 req                       | 1 min  | userId    |
| Assistant endpoints (summary, usage) | Token Bucket   | 10 req burst, 2 req/s refill | —      | machineId |
| Context bundle (heavy query)         | Fixed Window   | 10 req                       | 5 min  | machineId |

**Implementación:** Middleware `withRateLimit(config)` que wrappea el route handler. Usa Vercel KV (free tier: 30K req/mes — suficiente para MVP). Headers de respuesta:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1708531200
Retry-After: 30 (solo en 429)
```

### T.4 — Caching Strategy (Multi-Layer)

```
Client (TanStack Query) → CDN (Vercel Edge) → App Cache (ISR/KV) → Database (Prisma)
```

**Layer 1 — Browser (TanStack Query):**

- `staleTime: 30s` para listas (companies, products)
- `staleTime: 5s` para datos activos (echelon detail, sessions)
- `staleTime: 0` para datos en tiempo real (budget, realtime)
- Optimistic updates para mutations: UI se actualiza antes de confirmar server
- `queryKey` conventions: `['companies', { orgId }]`, `['echelons', echelonId, 'sessions']`

**Layer 2 — Vercel Edge (ISR + Cache-Control):**

- `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` para GET de listas
- `Cache-Control: private, no-cache` para datos de usuario, budget
- ISR con `revalidateTag()`: cuando un echelon cambia de estado → `revalidateTag('echelons')`
- `next/cache` `unstable_cache` para queries frecuentes con TTL corto

**Layer 3 — Application (Vercel KV):**

- Global Context Bundle: cacheado en KV con key `context:${echelonId}:${version}`. Invalidado cuando se valida un nuevo summary o cambia un RequiredField.
- Rate limit counters (compartido con T.3)
- Session tokens corta vida para device validation

**Layer 4 — Database (Prisma query cache):**

- Prisma Accelerate si se necesita (no en MVP). Por ahora, connection pooling via Supabase PgBouncer.

**Invalidation policy:**

- **Write-through**: toda mutación invalida el cache afectado inmediatamente.
- Tags para Next.js: `revalidateTag('companies')` al crear/editar company.
- KV: delete key explícito en el service que muta.
- TanStack Query: `queryClient.invalidateQueries({ queryKey: ['echelons', id] })` post-mutation.

### T.5 — HTTP Headers & Security

**Configuración en `next.config.ts` → `headers`:**

```typescript
// Se aplican a TODAS las rutas
{
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';",
}
```

**CORS (Route Handlers):**

```typescript
// Solo para /api/v1/* — el frontend no necesita CORS (same-origin)
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL, // Vercel domain
  'http://localhost:3000', // Dev
  'app://project-planning-assistant', // Electron deep-link
];
```

**Headers custom de la API:**

```
X-Request-Id: <uuid-v7>
X-RateLimit-*: (ver T.3)
X-API-Version: v1
```

### T.6 — Error Handling & Debugging

**Principio:** Errors are values, not exceptions.

```typescript
// Result<T, E> — No hay try-catch sueltos en el codebase
type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

// AppError — Typed, serializable, con context
class AppError {
  code: ErrorCode; // Enum: ECHELON_INVALID_TRANSITION, TENANT_MISMATCH, etc.
  message: string; // Human-readable
  httpStatus: number; // 400, 404, 409, 422, 500
  context?: Record<string, unknown>; // Debug data (no leaks a producción)
  cause?: Error; // Original error (para logging)
  requestId?: string; // Correlation
}
```

**Error boundary (global):**

- `withErrorHandling` middleware: captura cualquier error no manejado, lo formatea, logguea con context, retorna response estandarizada.
- En producción: `context` y `cause` NO se incluyen en la response (evitar info leak). Se loguean en Sentry.
- En dev: full stack trace + context en la response.

**Structured logging:**

```typescript
// Formato: JSON (parseable por Vercel, Sentry, cualquier log aggregator)
{
  "level": "error",
  "requestId": "uuid-v7",
  "userId": "xxx",
  "organizationId": "xxx",
  "module": "echelon",
  "action": "transition",
  "error": { "code": "ECHELON_INVALID_TRANSITION", "message": "..." },
  "duration_ms": 45,
  "timestamp": "ISO8601"
}
```

**Logger:** `pino` (fast, JSON, structured). Configurado con:

- `level` por env var (`LOG_LEVEL=debug` en dev, `LOG_LEVEL=info` en prod)
- Request context injection via `AsyncLocalStorage` (Node.js 22 native)
- Redaction de campos sensibles: passwords, tokens, API keys

**Debugging policy:**

- Cada route handler logguea: entrada (sanitized), salida (status + duration), errores.
- Cada service method logguea: operación, parámetros relevantes (no PII), resultado (ok/error).
- No `console.log`. Todo pasa por el logger estructurado.

### T.7 — Polling, Connectivity & Resilience

**Health check endpoint:**

```
GET /api/v1/health
Response: { "status": "ok", "checks": { "db": "ok", "supabase_auth": "ok" }, "version": "1.0.0", "uptime_ms": 12345 }
```

- Deep health check: valida conexión a Postgres, Supabase Auth reachable.
- Shallow health check (para uptime monitors): `GET /api/v1/health?shallow=true` → solo `{ "status": "ok" }`

**Frontend connectivity awareness:**

- `navigator.onLine` + custom heartbeat al backend (cada 30s cuando la tab está activa).
- Si offline → toast "Sin conexión", disable mutations, queue para retry.
- Supabase Realtime tiene reconnection built-in (exponential backoff).

**Retry policy (Assistant → Backoffice):**
El contrato define que el Assistant debe implementar retry con:

- Exponential backoff: 1s → 2s → 4s → 8s → max 30s
- Max 5 retries
- Idempotency-Key en POST requests (ver T.2) — safe to retry
- Circuit breaker: después de 5 failures consecutivos, dejar de intentar por 60s. Log alerta local.

**Database connection resilience:**

- Supabase PgBouncer en `transaction` mode (connection pooling)
- Prisma `connection_limit=5` en serverless (cada función abre pocas conexiones)
- `connect_timeout=10` en connection string

### T.8 — Idempotency Implementation

```
Tabla: idempotency_keys
- key: string (PK) — UUID del cliente
- route: string — e.g. "POST /api/v1/sessions/:id/summary"
- status: 'processing' | 'completed' | 'failed'
- response_status: number
- response_body: jsonb
- created_at: timestamp
- expires_at: timestamp (created_at + 24h)
```

**Flow:**

1. Request llega con header `Idempotency-Key: xxx`
2. Lookup en tabla. Si `completed` → retornar `response_body` inmediato (replay).
3. Si `processing` → retornar `409 Conflict` (request en progreso, retry later).
4. Si no existe → INSERT con `status: 'processing'`. Ejecutar handler. UPDATE con resultado.
5. Si falla → UPDATE `status: 'failed'`. El retry del cliente con el mismo key re-ejecuta.
6. Cleanup: pg_cron borra keys expirados cada hora.

**Endpoints que lo requieren:**

- `POST /sessions/:id/summary`
- `POST /usage`
- `POST /echelons/:id/consolidate`
- `POST /echelons/:id/close`
- `POST /auth/devices`

### T.9 — Code Quality Standards

**TypeScript:**

- `strict: true` (incluye `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`)
- `noUncheckedIndexedAccess: true` — array access retorna `T | undefined`
- Zero `any` — enforced por ESLint rule `@typescript-eslint/no-explicit-any: error`
- Zero `as` type assertions excepto en test files — enforced por ESLint rule
- Zod para runtime validation en boundaries (API input, external data). TypeScript solo no basta en runtime.
- Tipos inferidos donde sea posible. Tipos explícitos en function signatures públicas.
- `satisfies` operator para validar tipos sin widening.

**ESLint config (flat config — `eslint.config.mjs`):**

```
- typescript-eslint/strictTypeChecked (vía @eslint/eslintrc FlatCompat)
- eslint-config-next/core-web-vitals (compat layer para ESLint 9)
- eslint-plugin-import (order, no-duplicates)
- no-console: error (force pino logger)
- complexity: warn at 10, max-depth: warn at 3
- @typescript-eslint/require-await: off para src/app/api/** (stubs async intencionales)
```

> ⚠️ **Decisión de tooling**: `next lint` está deprecated en Next.js 15.5+ (se eliminará en Next 16). Migración pendiente: usar `eslint` CLI directamente con la config flat. El `lint-staged` ya usa `next lint --fix --file` como transitorio; actualizar a `eslint --fix` cuando se migre completamente.

**Prettier:** 2-space indent, single quotes, trailing commas all, 100 char line width. Plugin tailwind CSS habilitado.

**Commit conventions:**

- Conventional Commits enforced por commitlint
- `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`
- Scope requerido: `feat(echelon): add consolidation endpoint`
- Breaking changes: `feat(api)!: change summary payload format`

**Branch strategy:**

- `main` — production. Protected. Requiere PR + CI green.
- `develop` — integration. PRs from feature branches.
- `feat/xxx`, `fix/xxx`, `refactor/xxx` — feature branches from `develop`.
- Squash merge to `develop`. Regular merge `develop` → `main` para releases.

**Pre-commit hooks (Husky + lint-staged):**

1. `lint-staged`: ESLint fix + Prettier format en archivos staged
2. `tsc --noEmit`: Type check
3. `vitest related --run`: Ejecuta tests relacionados a archivos modificados. **Timeout máximo** (ej. 30s) para que el hook no bloquee; si no alcanza, ejecutar solo subconjunto de tests (ej. `tests/unit/`) en pre-commit y el resto en CI.

### T.10 — Monitoring & Observability

**Vercel built-in (free):**

- **Web Analytics**: page views, referrers, countries, devices. Componente `<Analytics />` en root layout.
- **Speed Insights**: Core Web Vitals (LCP, FID, CLS, INP, TTFB). Componente `<SpeedInsights />` en root layout.
- **Runtime Logs**: 1h retention en free tier. JSON structured via pino.
- **DDoS Protection**: Automatic Layer 3/4. Gratis en todos los planes.
- **WAF**: Rate limiting básico configurable en dashboard.

**Sentry (free tier: 5K errors/mes, 10K transactions/mes):**

- Frontend: `@sentry/nextjs` con source maps upload en build
- API: error tracking automático via `withErrorHandling` middleware
- Performance: transaction tracking en route handlers
- Release tracking: tag con git SHA del deploy

**Custom metrics (en structured logs — queryables):**

```
- api.request.duration_ms (por ruta)
- api.request.status (por ruta, por status code)
- echelon.transition (from_state, to_state, duration)
- summary.received (echelon_id, session_count)
- budget.threshold_crossed (org_id, threshold_pct)
- auth.device_enrolled (org_id)
- auth.login_failed (ip, reason)
- cache.hit_rate (layer, key_pattern)
- job.executed (type, status, duration)
```

**Alerting (Sentry + Supabase):**

- Sentry: alert on error spike (>10 errors in 5 min)
- Budget threshold: email via Edge Function (ver Fase 4)
- Uptime: Vercel checks o free external monitor (BetterStack free tier)

### T.11 — Database Design Standards

**Naming conventions (Postgres):**

- Tables: `snake_case`, plural (`echelons`, `required_fields`)
- Columns: `snake_case` (`organization_id`, `created_at`)
- Prisma model names: `PascalCase` (`Echelon`, `RequiredField`)
- Prisma maps: `@@map("echelons")`, `@map("organization_id")`

**Standard columns (toda tabla):**

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()  -- trigger on UPDATE
deleted_at  TIMESTAMPTZ  -- soft delete. NULL = active
version     INTEGER NOT NULL DEFAULT 1  -- optimistic locking (tablas mutables)
```

**Soft delete:**

- Toda tabla usa `deleted_at` en lugar de DELETE físico.
- Prisma middleware intercepta queries para filtrar `WHERE deleted_at IS NULL` por defecto.
- Queries explícitas con `includeDeleted: true` para audit/restore.
- Hard delete solo por pg_cron cleanup después de retention period (90 días).

**Indexes (definidos desde Fase 1, refinados en Fase 6):**

```sql
-- Composite indexes para queries frecuentes
CREATE INDEX idx_echelons_org_state ON echelons(organization_id, state) WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_echelon ON sessions(echelon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_summaries_session_state ON executive_summaries(session_id, state) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_machine_user ON devices(machine_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_usage_records_org_month ON usage_records(organization_id, month_year);
CREATE INDEX idx_audit_log_entity ON audit_logs(entity_type, entity_id, created_at);

-- pgvector index (Fase 3)
CREATE INDEX idx_summaries_embedding ON executive_summaries
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

**Migrations policy:**

- Toda migration es forward-only. No `down` migrations en producción.
- Breaking changes requieren multi-step: add new → migrate data → remove old.
- Migrations se ejecutan en CI antes del deploy (Prisma migrate deploy).

### T.12 — Environment & Configuration

**Environment variables (validadas con Zod al startup):**

```typescript
// src/lib/env.ts — fail fast si falta algo
const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(), // Bypass PgBouncer for migrations

  // Vercel
  VERCEL_URL: z.string().optional(), // Auto-set by Vercel
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  // External services
  RESEND_API_KEY: z.string().min(1),
  SENTRY_DSN: z.string().url().optional(),

  // LLM (para consolidation engine)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // App config
  APP_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32), // Para cifrar API keys de terceros
});
```

**`.env.example`** completo con todos los valores y comentarios. Committed al repo.
**`.env.local`** gitignored. Valores reales.
**Vercel Dashboard** → Environment Variables para staging/production.

---

## Arquitectura del Monorepo

```
project-planning-backoffice/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + Type-check + Test + Build
│       ├── deploy-preview.yml        # Preview deploy on PR
│       └── deploy-production.yml     # Production deploy on merge to main
├── .husky/
│   ├── pre-commit                    # lint-staged + tsc + related tests
│   └── commit-msg                    # conventional commits
├── prisma/
│   ├── schema.prisma                 # Source of truth del modelo
│   ├── migrations/                   # Forward-only migrations
│   ├── seed.ts                       # Seed data para dev
│   └── test-seed.ts                  # Seed data mínimo para tests
├── supabase/
│   ├── config.toml                   # Supabase CLI config
│   ├── migrations/                   # RLS policies, pgvector, indexes, pg_cron
│   └── functions/
│       ├── generate-pdf/             # Edge Function: generación PDF
│       ├── send-email/               # Edge Function: envío email
│       └── consolidate-echelon/      # Edge Function: consolidación IA
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout: providers, analytics, fonts
│   │   ├── error.tsx                 # Global error boundary
│   │   ├── not-found.tsx             # 404 page
│   │   ├── loading.tsx               # Root loading (streaming)
│   │   ├── (auth)/                   # Layout group: login, register
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/              # Layout group: autenticado
│   │   │   ├── layout.tsx            # Sidebar + Auth guard + Realtime provider
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── companies/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── loading.tsx       # Skeleton while fetching
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── products/page.tsx
│   │   │   ├── products/
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── echelons/page.tsx
│   │   │   ├── echelons/
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── loading.tsx
│   │   │   │       ├── sessions/page.tsx
│   │   │   │       └── consolidation/page.tsx
│   │   │   ├── devices/page.tsx
│   │   │   ├── budget/page.tsx
│   │   │   ├── audit-log/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       └── v1/
│   │           ├── auth/
│   │           │   ├── login/route.ts
│   │           │   ├── register/route.ts
│   │           │   ├── devices/
│   │           │   │   ├── route.ts
│   │           │   │   └── [machineId]/route.ts
│   │           │   └── refresh/route.ts
│   │           ├── companies/
│   │           │   ├── route.ts
│   │           │   └── [id]/route.ts
│   │           ├── products/
│   │           │   ├── route.ts
│   │           │   └── [id]/route.ts
│   │           ├── echelons/
│   │           │   ├── route.ts
│   │           │   └── [id]/
│   │           │       ├── route.ts
│   │           │       ├── launch/route.ts
│   │           │       ├── consolidate/route.ts
│   │           │       └── close/route.ts
│   │           ├── sessions/
│   │           │   ├── route.ts
│   │           │   └── [id]/
│   │           │       ├── route.ts
│   │           │       └── summary/route.ts
│   │           ├── usage/route.ts
│   │           ├── context/[echelonId]/route.ts
│   │           ├── webhooks/supabase/route.ts
│   │           └── health/route.ts
│   ├── schemas/                       # Single source of truth para shapes (Zod); tipos inferidos con z.infer (ver ENGINEERING_STANDARDS §2)
│   │   ├── company.schema.ts
│   │   ├── product.schema.ts
│   │   ├── echelon.schema.ts
│   │   ├── session.schema.ts
│   │   ├── summary.schema.ts
│   │   ├── device.schema.ts
│   │   ├── usage.schema.ts
│   │   ├── user.schema.ts
│   │   └── shared.schema.ts          # Pagination, API response, common fields
│   ├── modules/                      # Domain logic (transport-agnostic); tipos de entidad desde @/schemas/
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.guard.ts
│   │   │   ├── device.service.ts
│   │   │   └── device.repository.ts
│   │   ├── company/
│   │   │   ├── company.service.ts
│   │   │   └── company.repository.ts
│   │   ├── product/
│   │   │   ├── product.service.ts
│   │   │   └── product.repository.ts
│   │   ├── echelon/
│   │   │   ├── echelon.service.ts
│   │   │   ├── echelon.repository.ts
│   │   │   ├── echelon.state-machine.ts
│   │   │   └── required-field.service.ts
│   │   ├── session/
│   │   │   ├── session.service.ts
│   │   │   └── session.repository.ts
│   │   ├── summary/
│   │   │   ├── summary.service.ts
│   │   │   ├── summary.repository.ts
│   │   │   └── summary.state-machine.ts
│   │   ├── decision-link/
│   │   │   ├── decision-link.service.ts
│   │   │   └── decision-link.repository.ts
│   │   ├── budget/
│   │   │   ├── budget.service.ts
│   │   │   └── budget.repository.ts
│   │   ├── context-bundle/
│   │   │   └── context-bundle.service.ts
│   │   ├── integration/
│   │   │   ├── integration.engine.ts
│   │   │   ├── strategies/
│   │   │   │   ├── integration.strategy.ts    # Interface
│   │   │   │   ├── pm.strategy.ts             # Stub: Jira/Trello
│   │   │   │   ├── architecture.strategy.ts   # PDF, Mermaid
│   │   │   │   └── default.strategy.ts        # PDF + email
│   │   │   ├── pdf.adapter.ts
│   │   │   └── email.adapter.ts
│   │   ├── idempotency/
│   │   │   ├── idempotency.service.ts
│   │   │   └── idempotency.repository.ts
│   │   ├── audit/
│   │   │   ├── audit.service.ts
│   │   │   └── audit.repository.ts
│   │   └── tenant/
│   │       ├── tenant.service.ts
│   │       └── tenant.repository.ts
│   ├── lib/                          # Shared infrastructure
│   │   ├── prisma.ts                 # Singleton client + soft delete middleware
│   │   ├── supabase/
│   │   │   ├── server.ts
│   │   │   ├── client.ts
│   │   │   └── middleware.ts
│   │   ├── ai/
│   │   │   ├── provider.ts           # Vercel AI SDK provider config
│   │   │   └── consolidation.prompt.ts
│   │   ├── di/
│   │   │   └── container.ts          # Manual DI factory
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   ├── error-handler.ts
│   │   │   └── error-codes.ts
│   │   ├── result.ts                 # Result<T, E> pattern
│   │   ├── logger.ts                 # Pino structured logger
│   │   ├── env.ts                    # Zod env validation (fail fast)
│   │   ├── request-context.ts        # AsyncLocalStorage for requestId, userId, orgId
│   │   ├── validation/               # Helpers que importan de @/schemas/; los shapes de entidades viven en src/schemas/
│   │   │   └── schemas.ts            # Re-exports y helpers de validación (p. ej. parseQuery)
│   │   ├── middleware/
│   │   │   ├── with-auth.ts
│   │   │   ├── with-validation.ts
│   │   │   ├── with-tenant.ts
│   │   │   ├── with-rate-limit.ts
│   │   │   ├── with-idempotency.ts
│   │   │   ├── with-error-handling.ts
│   │   │   └── compose.ts            # Compose middlewares: compose(withAuth, withTenant, withValidation(schema))
│   │   ├── cache/
│   │   │   ├── kv.ts                 # Vercel KV wrapper
│   │   │   └── tags.ts               # Cache tag constants
│   │   └── utils/
│   │       ├── api-response.ts
│   │       ├── pagination.ts          # Cursor-based
│   │       └── crypto.ts             # Encrypt/decrypt API keys
│   ├── contracts/                    # API contracts (shared types)
│   │   ├── assistant-api.ts          # Zod schemas for Assistant endpoints
│   │   └── openapi.ts               # OpenAPI spec generator
│   ├── components/                   # UI components
│   │   ├── ui/                       # Shadcn/ui primitives
│   │   ├── providers/
│   │   │   ├── query-provider.tsx    # TanStack Query
│   │   │   ├── auth-provider.tsx     # Supabase Auth
│   │   │   └── theme-provider.tsx    # Dark mode
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   └── nav-items.ts
│   │   ├── forms/
│   │   │   ├── company-form.tsx
│   │   │   ├── product-form.tsx
│   │   │   ├── echelon-form.tsx
│   │   │   └── device-enroll-form.tsx
│   │   ├── tables/
│   │   │   ├── data-table.tsx
│   │   │   ├── columns/              # Column definitions per entity
│   │   │   └── data-table-toolbar.tsx
│   │   ├── echelon/
│   │   │   ├── echelon-state-badge.tsx
│   │   │   ├── echelon-timeline.tsx
│   │   │   ├── required-fields-checklist.tsx
│   │   │   └── consolidation-review.tsx
│   │   ├── budget/
│   │   │   └── usage-dashboard.tsx
│   │   └── shared/
│   │       ├── confirm-dialog.tsx
│   │       ├── loading-skeleton.tsx
│   │       ├── empty-state.tsx
│   │       ├── error-boundary.tsx
│   │       └── connectivity-banner.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-tenant.ts
│   │   ├── use-echelon.ts
│   │   ├── use-realtime.ts
│   │   └── use-connectivity.ts        # Online/offline detection
│   ├── stores/
│   │   └── auth-store.ts
│   └── types/                        # Solo tipos utilitarios (Result, PaginatedResponse, ApiResponse); tipos de entidad desde @/schemas/
│       └── index.ts                  # Re-exports de tipos no entidad
├── tests/
│   ├── unit/
│   │   ├── modules/
│   │   └── lib/
│   ├── integration/
│   │   ├── api/
│   │   └── modules/
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   ├── echelon-lifecycle.spec.ts
│   │   ├── device-enrollment.spec.ts
│   │   └── assistant-contract.spec.ts
│   ├── fixtures/
│   │   ├── factories.ts
│   │   └── mocks/                    # MSW handlers for external services
│   └── setup.ts
├── .env.example                      # Documented, committed
├── .env.local                        # Gitignored
├── eslint.config.mjs              # ESLint 9 flat config (reemplaza .eslintrc.cjs)
├── .prettierrc
├── commitlint.config.ts
├── next.config.ts                    # Headers, rewrites, env validation
├── tailwind.config.ts
├── tsconfig.json                     # strict + noUncheckedIndexedAccess
├── vitest.config.ts
├── playwright.config.ts
├── package.json                      # engines: { node: ">=22" }
├── pnpm-lock.yaml
└── vercel.json                       # Cron jobs, rewrites, headers
```

---

## Modelo de Datos (Prisma Schema)

### Multi-tenencia Enterprise

**Organization** es el tenant. Una consultora puede gestionar múltiples Companies bajo su Organization. Si `1 org = 1 company`, Organization actúa como Company wrapper.

### RBAC

| Rol             | Permisos                                                               |
| --------------- | ---------------------------------------------------------------------- |
| **SUPER_ADMIN** | Gestión global: tenants, billing, system config. Solo tú inicialmente. |
| **ADMIN**       | Gestión del tenant: companies, products, echelons, users, devices.     |
| **MANAGER**     | Gestión de products y echelons asignados. Puede cerrar eslabones.      |
| **MEMBER**      | Participa en sesiones, valida resúmenes de sus echelons.               |
| **VIEWER**      | Solo lectura. Accede a reportes y dashboards.                          |

### Aislamiento de datos

**Row-Level Security (RLS)** en Postgres vía Supabase (defense in depth):

- Cada tabla con columna `organization_id`
- Policies RLS que filtran por `auth.jwt() -> 'org_id'`
- Prisma queries pasan siempre por el tenant context middleware
- Doble barrera: RLS en DB + filtro en application layer

### Entidades principales

```
Organization (tenant)
├── OrganizationMember (join: user + role en esta org)
├── Company
│   └── Product
│       └── Echelon (FSM: OPEN → IN_PROGRESS → CLOSING → CLOSURE_REVIEW → CLOSED)
│           ├── RequiredField
│           │   └── DecisionLink (dependency matrix)
│           └── Session
│               └── ExecutiveSummary (FSM: DRAFT → REVIEW → EDITED → VALIDATED)
│                   ├── Attachment (Supabase Storage ref)
│                   └── DecisionLink
├── Device (machine_id enrollment)
└── UsageRecord (budget tracking)

IdempotencyKey (cross-cutting: replay protection)
AuditLog (cross-cutting: quién hizo qué, cuándo)
User (global, no scoped a org — un user puede pertenecer a múltiples orgs)
```

---

## Fases de Desarrollo

### FASE 0 — Scaffolding, Tooling & Infrastructure (Semana 1-2)

**Objetivo:** Proyecto funcional con CI/CD, DB conectada, auth operativo, deploy automático. Todas las capas transversales configuradas.

| #    | Tarea                                  | Detalle                                                                                                                                                                                                                | Entregable                                                                            |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 0.1  | **Inicializar proyecto**               | `pnpm create next-app@latest` con App Router, TypeScript strict, Tailwind v4, ESLint. `"engines": { "node": ">=22" }` en package.json.                                                                                 | `package.json`, `tsconfig.json` (strict + noUncheckedIndexedAccess), `next.config.ts` |
| 0.2  | **Configurar herramientas de calidad** | ESLint (flat config + @typescript-eslint/strict-type-checked), Prettier, Husky (pre-commit: lint-staged + tsc + vitest related), commitlint (conventional commits).                                                    | `.eslintrc.cjs`, `.prettierrc`, `.husky/`, `commitlint.config.ts`                     |
| 0.3  | **Structured logger**                  | Configurar pino: JSON output, level por env, redaction de secrets. `AsyncLocalStorage` para request context (requestId, userId, orgId).                                                                                | `src/lib/logger.ts`, `src/lib/request-context.ts`                                     |
| 0.4  | **Environment validation**             | Zod schema para todas las env vars. Fail fast al import. `.env.example` documentado.                                                                                                                                   | `src/lib/env.ts`, `.env.example`                                                      |
| 0.5  | **Result pattern + Error system**      | `Result<T, E>`, `AppError` class, `ErrorCode` enum, `withErrorHandling` middleware.                                                                                                                                    | `src/lib/result.ts`, `src/lib/errors/`                                                |
| 0.6  | **API response + middleware**          | Standardized response format. `compose()` para middleware chain. `withAuth`, `withValidation`, `withTenant`, `withRateLimit`, `withIdempotency`, `withErrorHandling`.                                                  | `src/lib/middleware/`, `src/lib/utils/api-response.ts`                                |
| 0.7  | **Configurar testing**                 | Vitest (unit/integration), Testing Library (components), Playwright (E2E). Config files + primer test de smoke. MSW para mocks de servicios externos.                                                                  | `vitest.config.ts`, `playwright.config.ts`, smoke test                                |
| 0.8  | **Crear proyecto Supabase**            | Crear proyecto en Supabase dashboard. Obtener connection strings, keys. Configurar Supabase CLI local (`supabase init`, `supabase start`).                                                                             | `.env.local` con valores, `supabase/config.toml`                                      |
| 0.9  | **Configurar Prisma**                  | `prisma init`. Datasource apuntando a Supabase PG (con PgBouncer + direct URL para migrations). Schema inicial con tabla `health_check`. Primer migration exitoso. Soft delete middleware.                             | `prisma/schema.prisma`, `src/lib/prisma.ts`                                           |
| 0.10 | **Configurar Supabase Auth**           | Habilitar email/password. Configurar JWT custom claims (org_id, role). Helper clients (server + browser).                                                                                                              | `src/lib/supabase/server.ts`, `client.ts`, `middleware.ts`                            |
| 0.11 | **Next.js middleware (auth)**          | `middleware.ts` en root: valida JWT, redirige a login si no autenticado.                                                                                                                                               | Rutas protegidas                                                                      |
| 0.12 | **Security headers**                   | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy en `next.config.ts`.                                                                                                           | Headers activos en cada response                                                      |
| 0.13 | **DI Container**                       | Manual factory pattern. Registrar Prisma, Supabase, Logger como singletons.                                                                                                                                            | `src/lib/di/container.ts`                                                             |
| 0.14 | **CI/CD Pipeline**                     | GitHub Actions: on push/PR → install → lint → type-check → test → build. Branch protection en `main` y `develop`.                                                                                                      | `.github/workflows/ci.yml`                                                            |
| 0.15 | **Deploy pipeline**                    | Conectar repo a Vercel. Preview deploys en PRs. Production deploy en merge a `main`. Env vars en Vercel. Node.js 22 en project settings.                                                                               | `.github/workflows/deploy-*.yml`, `vercel.json`                                       |
| 0.16 | **Vercel features setup**              | Habilitar Web Analytics + Speed Insights (componentes en root layout). Configurar Vercel KV (store). WAF rate limit básico en dashboard. Log o métrica de uso de KV (reads/writes) para monitorear límite 30K req/mes. | `<Analytics />`, `<SpeedInsights />` en layout                                        |
| 0.17 | **Shadcn/ui + Layout shell**           | `npx shadcn-ui@latest init`. Componentes base. Layout con sidebar, header, breadcrumbs. Dark mode. Login page.                                                                                                         | UI shell navegable                                                                    |
| 0.18 | **Sentry setup**                       | `@sentry/nextjs`. Source maps. Error boundary en root layout.                                                                                                                                                          | Error tracking operativo                                                              |
| 0.19 | **Health endpoint**                    | `GET /api/v1/health` — deep y shallow check. DB connectivity test.                                                                                                                                                     | Endpoint + test                                                                       |
| 0.20 | **Pagination + Cursor utility**        | Cursor-based pagination genérico.                                                                                                                                                                                      | `src/lib/utils/pagination.ts` + tests                                                 |

**Criterio de salida Fase 0:**

- `pnpm dev` levanta con auth funcional (login/logout)
- CI green (lint + types + smoke test)
- Deploy a Vercel preview funciona
- Prisma conecta a Supabase PG
- Logger structured operativo
- Security headers activos
- Sentry capturando errors
- Analytics/SpeedInsights tracking
- Health endpoint respondiendo
- Env vars validadas al startup

---

### FASE 1 — Core Domain Model, RBAC & Multi-Tenancy (Semana 2-3)

**Objetivo:** Modelo de datos completo en Postgres, RLS activo, RBAC enforced, CRUD base de las entidades core.

| #    | Tarea                         | Detalle                                                                                                                                                                                                                                                                           | Entregable                                  |
| ---- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1.1  | **Prisma Schema completo**    | Todas las entidades: Organization, User, OrganizationMember, Company, Product, Echelon, Session, ExecutiveSummary, Attachment, RequiredField, DecisionLink, Device, UsageRecord, IdempotencyKey, AuditLog. Relaciones, índices compuestos (ver T.11), enums, soft delete columns. | `prisma/schema.prisma`                      |
| 1.2  | **Migrations**                | `prisma migrate dev`. Verificar tablas en Supabase dashboard.                                                                                                                                                                                                                     | `prisma/migrations/`                        |
| 1.3  | **RLS Policies**              | SQL migrations: policies para cada tabla filtrando por `organization_id` del JWT claim. Test: user org A no ve datos org B.                                                                                                                                                       | `supabase/migrations/xxxx_rls_policies.sql` |
| 1.4  | **Seed data**                 | Script: 1 org, 2 companies, 3 products, echelons ejemplo, users con distintos roles.                                                                                                                                                                                              | `prisma/seed.ts`                            |
| 1.5  | **Auth guard + Tenant guard** | `withAuth.ts` + `withTenant.ts`. JWT validation, inyección de context, tenant filtering automático.                                                                                                                                                                               | Middlewares + unit tests                    |
| 1.6  | **RBAC guard**                | `withRole(minimumRole)`. Valida rol del user para el endpoint. Matriz de permisos definida.                                                                                                                                                                                       | `with-role.ts` + permission matrix          |
| 1.7  | **Organization module**       | Service + Repository + Routes. CRUD. Solo SUPER_ADMIN.                                                                                                                                                                                                                            | `/api/v1/organizations/`                    |
| 1.8  | **User management**           | Invite, assign role, list members, remove. Integración Supabase Auth.                                                                                                                                                                                                             | `/api/v1/organizations/[id]/members/`       |
| 1.9  | **Company module**            | CRUD completo. Tenant filtered. Cursor pagination.                                                                                                                                                                                                                                | `/api/v1/companies/`                        |
| 1.10 | **Product module**            | CRUD. Relación con Company. Validación tenant.                                                                                                                                                                                                                                    | `/api/v1/products/`                         |
| 1.11 | **Audit Log module**          | Service + middleware cross-cutting. Logguea toda mutación automáticamente.                                                                                                                                                                                                        | Auto-logging en cada write                  |
| 1.12 | **Idempotency module**        | `IdempotencyKey` tabla + service + middleware `withIdempotency`. Cleanup via pg_cron (24h).                                                                                                                                                                                       | `src/modules/idempotency/`                  |
| 1.13 | **Tests Fase 1**              | Unit: services (mock repos). Integration: route handlers con DB real (Supabase local). RLS isolation test. RBAC test (cada rol).                                                                                                                                                  | ≥70% coverage módulos Fase 1                |

**Criterio de salida Fase 1:**

- CRUD Org → Company → Product funcional
- RLS: aislamiento de datos verificado con test
- RBAC: roles enforced, 5 tests por rol
- Audit log automático
- Idempotency operativo
- Soft delete en todas las entidades

---

### FASE 2 — Echelon State Machine & Session Lifecycle (Semana 3-5)

**Objetivo:** Ciclo de vida del eslabón con multi-reunión, RequiredFields, y consolidación.

| #    | Tarea                        | Detalle                                                                                                                                                                                        | Entregable                        |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 2.1  | **Echelon State Machine**    | FSM pura en `echelon.state-machine.ts`: `OPEN → IN_PROGRESS → CLOSING → CLOSURE_REVIEW → CLOSED`. `transition(state, event) → Result<State, TransitionError>`. Sin side effects en la función. | FSM testable, 100% coverage       |
| 2.2  | **Summary State Machine**    | FSM: `DRAFT → REVIEW → EDITED → VALIDATED`. Misma estructura.                                                                                                                                  | FSM testable                      |
| 2.3  | **Echelon module**           | CRUD + transiciones de estado. `config_blueprint` como JSON schema. Optimistic locking (version column).                                                                                       | `/api/v1/echelons/` completo      |
| 2.4  | **RequiredField module**     | CRUD por echelon. `is_met` flag. Dependency tracking.                                                                                                                                          | Service + Repository + Routes     |
| 2.5  | **DecisionLink module**      | Links entre RequiredFields y ExecutiveSummaries. Dependency Matrix.                                                                                                                            | Service + Repository + Routes     |
| 2.6  | **Session module**           | CRUD. Primera sesión → echelon OPEN → IN_PROGRESS.                                                                                                                                             | `/api/v1/echelons/[id]/sessions/` |
| 2.7  | **ExecutiveSummary module**  | CRUD + FSM. Solo `VALIDATED` summaries cuentan para consolidación.                                                                                                                             | Service con FSM                   |
| 2.8  | **Optimistic Locking**       | `version` column en Echelon y ExecutiveSummary. `WHERE id = X AND version = Y` en updates. 409 Conflict si mismatch.                                                                           | Race conditions prevenidas        |
| 2.9  | **readyToClose computed**    | Evalúa RequiredFields `is_met = true`. Expuesto en API response.                                                                                                                               | Campo computado en GET            |
| 2.10 | **Consolidation trigger**    | `POST /echelons/[id]/consolidate`. Validación: `readyToClose`, idempotent. → CLOSING.                                                                                                          | Endpoint + idempotency            |
| 2.11 | **Close trigger**            | `POST /echelons/[id]/close`. Solo desde CLOSURE_REVIEW. Inmutable post-cierre. Dispara integration (Fase 4).                                                                                   | Endpoint                          |
| 2.12 | **Attachment module**        | Upload Supabase Storage. Signed URLs para download. Bucket policies por tenant.                                                                                                                | Upload/download                   |
| 2.13 | **Cache layer para echelon** | Vercel KV para cachear echelon detail (high-read). Invalidate on mutation. Cache tags para ISR.                                                                                                | `revalidateTag('echelons')`       |
| 2.14 | **Tests Fase 2**             | FSM: todos los paths (feliz + inválido + concurrent). Integration: lifecycle OPEN→CLOSED completo. Optimistic lock conflict test.                                                              | ≥75% coverage                     |

**Criterio de salida Fase 2:**

- Lifecycle OPEN → CLOSED funcional
- Multi-sesión con N summaries
- RequiredFields bloquean cierre
- Optimistic locking previene races
- Caching layer operativo para reads frecuentes

---

### FASE 3 — Assistant Integration Contracts (Semana 5-6)

**Objetivo:** Endpoints que el Assistant consumirá. Contratos definidos, documentados, testeados.

| #    | Tarea                                    | Detalle                                                                                                                                        | Entregable                       |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 3.1  | **Device Enrollment**                    | `POST /auth/devices` — `{ machineId, userId, osInfo }`. Idempotent (Idempotency-Key).                                                          | Endpoint + schema + tests        |
| 3.2  | **Device Validation**                    | `GET /auth/devices/[machineId]` — Validate authorized. Return encrypted API keys (short-lived token). Rate limited: 10 req/5min per machineId. | Secure endpoint                  |
| 3.3  | **Device Revocation**                    | `DELETE /auth/devices/[machineId]` — Admin only. Subsequent validations fail.                                                                  | Endpoint + test                  |
| 3.4  | **Launch Assistant**                     | `POST /echelons/[id]/launch` — Prepara payload deep-link: context, RequiredFields, embeddings.                                                 | Typed payload                    |
| 3.5  | **Global Context Bundle**                | `GET /context/[echelonId]` — RequiredFields + ranked retrieval + decision anchors. Cached in KV.                                               | Cached + invalidatable           |
| 3.6  | **Ranked Retrieval (pgvector)**          | `context-bundle.service.ts`: similarity search en embeddings de summaries previos. Limit tokens totales.                                       | Tested with mock embeddings      |
| 3.7  | **POST Summary**                         | `POST /sessions/[id]/summary` — Idempotent. Transaccional: persist summary + update RequiredFields + update echelon state.                     | Atomic endpoint                  |
| 3.8  | **POST Usage**                           | `POST /usage` — Idempotent. Budget update.                                                                                                     | Endpoint + budget check          |
| 3.9  | **pgvector setup**                       | Extension `vector` en Supabase. Column `embedding vector(768)`. HNSW index. Prisma raw query helpers.                                          | Migration + helpers              |
| 3.10 | **API Key encryption**                   | AES-256-GCM para cifrar keys de terceros en DB. Key derivation del Machine-ID para entrega segura.                                             | `src/lib/utils/crypto.ts`        |
| 3.11 | **Contract schemas**                     | Zod schemas exportables para todos los endpoints de integración. OpenAPI spec generation.                                                      | `src/contracts/assistant-api.ts` |
| 3.12 | **Rate limits para Assistant endpoints** | Token bucket: 10 burst, 2 req/s refill por machineId. Context bundle: 10 req/5min.                                                             | Rate limits configurados         |
| 3.13 | **Tests Fase 3**                         | Contract tests simulando flow completo del Assistant.                                                                                          | Full simulation passing          |

**Criterio de salida Fase 3:**

- Flow completo simulado: enroll → validate → get context → N summaries → close
- pgvector ranked retrieval operativo
- Rate limits activos para endpoints del Assistant
- Idempotency en todos los POST
- OpenAPI spec generada

---

### FASE 4 — Async Jobs, Integration Engine & AI Consolidation (Semana 6-7)

**Objetivo:** Procesos asincrónicos: PDF gen, emails, consolidación IA, triggers.

| #    | Tarea                           | Detalle                                                                                                                                                                                                                                                                                      | Entregable                                |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 4.1  | **Job queue en Postgres**       | Tabla `jobs` con types, status, retries, scheduled_at, payload. pg_net para invocar Edge Functions.                                                                                                                                                                                          | Table + dispatch function                 |
| 4.2  | **Vercel AI SDK setup**         | Configurar `ai` package con provider Anthropic/OpenAI. `generateObject()` con Zod output schema. Token tracking.                                                                                                                                                                             | `src/lib/ai/provider.ts`                  |
| 4.3  | **Consolidation Engine**        | Edge Function: recopila summaries VALIDATED → `generateObject()` con schema del reporte → persiste → transition a CLOSURE_REVIEW. Prompt alimentado SOLO por summaries validados. Definir **límite máximo de tokens de entrada**; si se supera → error explícito (413) y mensaje al usuario. | `supabase/functions/consolidate-echelon/` |
| 4.4  | **Consolidation prompt**        | 6-layer prompt: role, context (echelon type + RequiredFields), summaries, output rules, format. RequiredFields como checklist en output.                                                                                                                                                     | `src/lib/ai/consolidation.prompt.ts`      |
| 4.5  | **PDF generation**              | Edge Function: `@react-pdf/renderer`. Template por tipo de eslabón. Upload a Supabase Storage. Create Attachment record.                                                                                                                                                                     | `supabase/functions/generate-pdf/`        |
| 4.6  | **Email service**               | Edge Function: Resend SDK + React Email templates. Templates: device enrolled, echelon state change, consolidation ready, echelon closed, budget alert.                                                                                                                                      | `supabase/functions/send-email/`          |
| 4.7  | **Integration Strategy Engine** | Strategy pattern: al cerrar echelon, ejecutar estrategia según `config_blueprint.type`. MVP: default strategy = PDF + email. PM/Architecture strategies = stubs.                                                                                                                             | `src/modules/integration/strategies/`     |
| 4.8  | **Database Webhooks**           | `echelon.state` change → trigger notification. `executive_summary` created → trigger processing.                                                                                                                                                                                             | Webhooks configured                       |
| 4.9  | **Budget alerts**               | USAGE_RECORD insert → check threshold (80%, 100%) → email alert.                                                                                                                                                                                                                             | Alert pipeline                            |
| 4.10 | **Retry + Dead Letter**         | Exponential backoff: 3 attempts. After 3 failures → dead_letter status + admin notification.                                                                                                                                                                                                 | Retry logic                               |
| 4.11 | **Tests Fase 4**                | Mock LLM responses (MSW). Integration: echelon close → PDF + email. Retry test.                                                                                                                                                                                                              | ≥70% coverage                             |

**Criterio de salida Fase 4:**

- Consolidation engine genera reporte structured
- Cerrar echelon → PDF generado + email enviado
- Retry + dead letter operativo
- Budget alerts disparándose
- AI SDK token tracking en UsageRecord

---

### FASE 5 — Web Admin Frontend (Semana 7-10)

**Objetivo:** Interfaz de administración completa. Usar v0.dev para acelerar scaffolding de componentes.

| #    | Tarea                               | Detalle                                                                                                                                                                                       | Entregable                                    |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 5.1  | **Design tokens**                   | Color palette, spacing, typography en Tailwind config. Dark mode variables CSS. v0.dev para explorar layouts rápido.                                                                          | `tailwind.config.ts`                          |
| 5.2  | **TanStack Query setup**            | Provider, default options (`staleTime`, `gcTime`), devtools. Query key factory pattern.                                                                                                       | `src/components/providers/query-provider.tsx` |
| 5.3  | **Auth pages**                      | Login, Register (invite-only), Forgot password. Supabase Auth integration. `use-auth.ts` hook.                                                                                                | Auth flow completo                            |
| 5.4  | **Dashboard home**                  | RSC para data fetching. Cards: echelons activos, últimos summaries, budget gauge, devices online. Charts (Recharts). `loading.tsx` con skeleton streaming.                                    | Dashboard con streaming                       |
| 5.5  | **Companies CRUD**                  | DataTable (TanStack Table): sort, filter, paginate (cursor). Forms (RHF + Zod). Optimistic delete.                                                                                            | `/companies`                                  |
| 5.6  | **Products CRUD**                   | Misma estructura. Nested bajo company. Breadcrumb navigation.                                                                                                                                 | `/products`                                   |
| 5.7  | **Echelons management**             | Lista por producto. State badges. Filtros por estado. Create con `config_blueprint` selector.                                                                                                 | `/echelons`                                   |
| 5.8  | **Echelon detail (core)**           | Estado actual (FSM visual). RequiredFields checklist. Sessions timeline. Summaries list. Attachments. Action buttons contextuales (Launch, Consolidate, Close). Server Action para mutations. | `/echelons/[id]` — pantalla principal         |
| 5.9  | **RequiredFields editor**           | CRUD interactivo. Dependency editor (link to other echelon fields). Visual dependency matrix.                                                                                                 | Editor                                        |
| 5.10 | **Session detail + Summary editor** | Summary state badge. Rich text editor (Tiptap). Approve/reject workflow. Diff view.                                                                                                           | `/echelons/[id]/sessions/[sid]`               |
| 5.11 | **Consolidation review**            | Reporte consolidado. Tiptap editor para edición humana. Diff (IA vs editado). "Aprobar y Cerrar" button.                                                                                      | `/echelons/[id]/consolidation`                |
| 5.12 | **Launch Assistant flow**           | Modal: contexto que se inyectará. Generar deep-link. Copy to clipboard.                                                                                                                       | Launch UX                                     |
| 5.13 | **Device management**               | Lista dispositivos. Enroll (manual or QR). Revoke. Last seen, OS.                                                                                                                             | `/devices`                                    |
| 5.14 | **Budget dashboard**                | Usage por producto, echelon, período. Charts. Alert config.                                                                                                                                   | `/budget`                                     |
| 5.15 | **Audit log viewer**                | Tabla filtrable: actor, entity, action, date range.                                                                                                                                           | `/audit-log`                                  |
| 5.16 | **Settings**                        | Profile, org settings, API keys management (masked + rotation UX), notification preferences.                                                                                                  | `/settings`                                   |
| 5.17 | **Realtime**                        | Supabase Realtime hook: `use-realtime.ts`. Subscribe to echelon changes, new summaries. Toast + data refetch.                                                                                 | Live updates                                  |
| 5.18 | **Connectivity awareness**          | `use-connectivity.ts`: online/offline detection. Banner. Queue mutations.                                                                                                                     | Resilient UX                                  |
| 5.19 | **Responsive + Accessibility**      | Sidebar collapse. Keyboard nav. ARIA. Contrast AA.                                                                                                                                            | Audit pass                                    |
| 5.20 | **Error/Empty/Loading states**      | Every page: skeleton (streaming), empty state (CTA), error state (retry).                                                                                                                     | Consistent UX                                 |
| 5.21 | **Tests Fase 5**                    | Component tests (Testing Library). E2E (Playwright): login → create company → echelon lifecycle → close.                                                                                      | ≥70% UI coverage                              |

**Criterio de salida Fase 5:**

- Cycle completo: Org → Company → Product → Echelon → Sessions → Consolidation → Close
- Realtime updates operativos
- Responsive + dark mode + accessibility
- E2E happy path green

---

### FASE 6 — Security Hardening & Production Readiness (Semana 10-11)

**Objetivo:** Listo para presentar a empresas. Audit de seguridad. Performance. Docs.

| #    | Tarea                         | Detalle                                                                                                                                                     | Entregable                    |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 6.1  | **Security audit**            | Revisar todos los endpoints: auth, tenant isolation, rate limits, input validation. Verificar CSP, CORS. Penetration test básico con OWASP ZAP o Burp free. | Audit report + fixes          |
| 6.2  | **Rate limit tuning**         | Ajustar limits basado en uso real de desarrollo. Verificar que WAF + Upstash layers funcionan correctamente.                                                | Limits documentados           |
| 6.3  | **Input sanitization review** | Verificar Zod strictness en cada endpoint. HTML sanitization (DOMPurify) para rich text. Verificar raw queries pgvector.                                    | Audit pass                    |
| 6.4  | **API key rotation UX**       | Admin puede rotar keys de terceros sin downtime. Versioned keys. Old key grace period 24h.                                                                  | Rotation flow                 |
| 6.5  | **Audit log completeness**    | Verificar que TODAS las mutaciones tienen trail. Filtrado UI por actor, entity, date.                                                                       | 100% mutation coverage        |
| 6.6  | **Performance audit**         | Lighthouse (>80). Core Web Vitals via Speed Insights. N+1 query detection (Prisma logging). DB query EXPLAIN ANALYZE.                                       | Baseline + fixes              |
| 6.7  | **Database index tuning**     | Composite indexes basados en query patterns reales. EXPLAIN ANALYZE en queries críticas: context bundle, echelon list, audit log.                           | Optimized indexes             |
| 6.8  | **Cache effectiveness**       | Verify KV hit rates. TanStack Query staleTime tuning. ISR revalidation intervals.                                                                           | Cache metrics                 |
| 6.9  | **Backup strategy**           | Supabase PITR (pro feature — document for upgrade). Manual `pg_dump` script para free tier.                                                                 | Backup documented/operational |
| 6.10 | **Documentation**             | README (setup <15 min). `.env.example` final. OpenAPI spec final. ADRs para todas las decisiones clave. CONTRIBUTING guide.                                 | Docs completos                |
| 6.11 | **Uptime monitoring**         | BetterStack (free tier) o similar. Alert on downtime. Status page (optional).                                                                               | Monitor configured            |

**Criterio de salida Fase 6:**

- Security audit passed (no critical/high)
- Lighthouse >80
- Cache hit rates documented
- Monitoring operational
- Docs allow new dev to start in <15min

---

### FASE 7 — Testing & Quality Gate (Semana 11-12)

**Objetivo:** Coverage al target. Integration end-to-end. Bug bash.

| #   | Tarea                        | Detalle                                                                                                                                            | Entregable                    |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 7.1 | **Coverage analysis**        | Identify modules below 70%. Prioritize: FSMs, auth, budget, idempotency.                                                                           | Coverage report               |
| 7.2 | **Unit test gap fill**       | Edge cases: invalid transitions, concurrent updates, budget overflow, rate limit boundaries, idempotency replay.                                   | ≥75% global                   |
| 7.3 | **Integration test gap**     | Cross-module flows: session → summary → RequiredFields → consolidate → close. RLS isolation. RBAC boundaries.                                      | Happy + failure paths         |
| 7.4 | **E2E suite**                | Playwright: 8-10 flows. Auth, CRUD, echelon lifecycle, device enrollment, budget tracking, consolidation.                                          | Stable E2E suite              |
| 7.5 | **Contract test: Assistant** | Simulate full Assistant flow: enroll → validate → get context → N summaries → post usage → close. With idempotency replays and rate limit testing. | `assistant-contract.spec.ts`  |
| 7.6 | **Load test (baseline)**     | k6 or Artillery: 50 concurrent users. Identify bottlenecks. DB connection pool saturation test.                                                    | Report + fixes                |
| 7.7 | **Bug bash**                 | Full UI walkthrough. Fix everything found.                                                                                                         | Zero known critical/high bugs |
| 7.8 | **Final CI run**             | Full pipeline: lint → types → unit → integration → E2E → build → deploy staging.                                                                   | Green pipeline                |

**Criterio de salida Fase 7:**

- ≥75% coverage global
- E2E suite green
- Contract test passing (including idempotency + rate limits)
- Load test baseline documented
- Zero critical/high bugs
- Staging deployed and functional

---

## Pantallas del MVP

| #   | Pantalla                        | Complejidad | v0.dev assist     |
| --- | ------------------------------- | ----------- | ----------------- |
| 1   | Login                           | Baja        | Sí                |
| 2   | Register (invite)               | Baja        | Sí                |
| 3   | Dashboard home                  | Media       | Sí (layout)       |
| 4   | Companies list                  | Baja        | Sí (DataTable)    |
| 5   | Company detail + products       | Media       | Parcial           |
| 6   | Product detail + echelons       | Media       | Parcial           |
| 7   | **Echelon detail**              | **Alta**    | No (custom logic) |
| 8   | Session detail + summary editor | Alta        | Parcial (editor)  |
| 9   | Consolidation review + editor   | Alta        | Parcial           |
| 10  | Device management               | Media       | Sí                |
| 11  | Budget dashboard                | Media       | Sí (charts)       |
| 12  | Settings / Profile              | Baja        | Sí                |
| 13  | Audit log viewer                | Baja        | Sí (table)        |

**Total: 13 pantallas.** v0.dev acelera ~7 de las 13 (scaffolding base, luego customización).

---

## Decisiones de Arquitectura (ADRs)

| #       | Decisión                                 | Razón                                                  | Trade-off                                                   |
| ------- | ---------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| ADR-001 | Monorepo Next.js (API + Frontend)        | 1 dev, $0 infra, deploy unificado                      | Migrar a Express standalone si necesita WebSockets post-MVP |
| ADR-002 | Supabase como plataforma                 | Auth + DB + Storage + Realtime + Edge Functions gratis | Vendor lock-in parcial. Mitigable: Prisma directo a PG      |
| ADR-003 | RLS + app-level filtering                | Defense in depth                                       | RLS debugging más complejo                                  |
| ADR-004 | Result<T,E> pattern                      | Errors como valores. Composable. Fuerza handling       | Más verbose. Requiere disciplina                            |
| ADR-005 | pgvector para Ranked Retrieval           | Sin infra adicional                                    | No es vector DB dedicado. OK para MVP                       |
| ADR-006 | Optimistic locking (version)             | Previene races sin locks pesimistas                    | Retry logic en cliente                                      |
| ADR-007 | Supabase Edge Functions para jobs        | Sin Redis                                              | Cold starts. 150s timeout. Chunking si excede               |
| ADR-008 | Prisma como ORM                          | Type-safety, migrations, productividad                 | Raw queries para pgvector + RLS                             |
| ADR-009 | Idempotency keys en POST críticos        | Safe retries para Assistant. Previene duplicados       | Tabla extra + TTL cleanup                                   |
| ADR-010 | Pino structured logging                  | JSON parseable, fast, redaction                        | No pretty-print en prod (design choice)                     |
| ADR-011 | Vercel AI SDK para consolidación         | Provider-agnostic, structured output, token tracking   | Dependency en Vercel ecosystem                              |
| ADR-012 | Multi-layer caching (TQ + ISR + KV + DB) | Minimizar DB hits, mejorar UX                          | Invalidation complexity                                     |
| ADR-013 | Node.js 22 LTS                           | Stable, `AsyncLocalStorage` mature, Vercel native      | No bleeding edge features de Node 24                        |
| ADR-014 | v0.dev para UI scaffolding               | Acelera frontend 30-40%                                | Requiere cleanup post-generation                            |

---

## Timeline estimado (1 dev, full-time)

| Fase                                | Duración          | Semanas   |
| ----------------------------------- | ----------------- | --------- |
| Fase 0: Scaffolding + Transversales | 2 semanas         | 1-2       |
| Fase 1: Core Domain + RBAC          | 1.5 semanas       | 2-3.5     |
| Fase 2: Echelon Lifecycle           | 2 semanas         | 3.5-5.5   |
| Fase 3: Assistant Contracts         | 1.5 semanas       | 5.5-7     |
| Fase 4: Async Jobs + AI             | 1.5 semanas       | 7-8.5     |
| Fase 5: Frontend                    | 3 semanas         | 8.5-11.5  |
| Fase 6: Security + Production       | 1 semana          | 11.5-12.5 |
| Fase 7: Testing Quality Gate        | 1 semana          | 12.5-13.5 |
| **Total**                           | **~13.5 semanas** |           |

**Buffer incluido:** 1.5 semanas extra vs v1.0 por las capas transversales adicionales.

---

## Riesgos

| Riesgo                                | Probabilidad | Impacto | Mitigación                                                                |
| ------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------- |
| Supabase 500MB insuficiente           | Media        | Alto    | Monitor desde Fase 1. Upgrade $25/mes si necesario                        |
| Vercel 10s timeout para consolidación | Alta         | Medio   | Consolidación en Supabase Edge Function (150s)                            |
| Vercel KV 30K req/mes agotado         | Media        | Medio   | Monitor uso. Fallback a DB queries directas. Upstash directo si necesario |
| pgvector performance >100K embeddings | Baja (MVP)   | Medio   | Monitor. Migrar a Pinecone/Qdrant post-MVP                                |
| Frontend scope creep (13 pantallas)   | Alta         | Alto    | MVP con 7-8 pantallas. Resto iterativo                                    |
| v0.dev output quality inconsistente   | Media        | Bajo    | Cleanup manual. Solo scaffolding, no lógica                               |
| 1 dev fatigue semana 10+              | Media        | Crítico | Fases incrementales — cada fase es deployable                             |

---

## Qué NO está en este MVP

- Integraciones externas (Jira, Trello, ClickUp) — stubs + Strategy Pattern extensible
- OAuth/SSO enterprise (Google, SAML) — solo email/password
- i18n — español hardcoded, estructura para i18n futura
- Billing/subscription — no monetización
- Realtime collaborative editing — un editor por vez
- AI features en frontend (chat, autocomplete)
- Mobile app
- WebSocket connections (Supabase Realtime cubre el caso)
- Advanced analytics (funnels, cohorts)
