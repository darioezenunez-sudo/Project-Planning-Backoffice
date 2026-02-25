# Engineering Standards & Conventions — Project-Planning Backoffice

**Versión:** 1.2 · **Fecha:** 2026-02-22 · **Estado:** Activo
**Complementa:** `DEVELOPMENT_PLAN_MVP.md` — este documento define las reglas que todo código debe cumplir. Para fases, tareas y arquitectura del monorepo, ver el Plan; para patrones de dominio (T.1), API (T.2), paginación (T.2) y capas transversales, el Plan referencia estos estándares.

---

## Tabla de Contenidos

1. [Paradigma de Programación](#1-paradigma-de-programación)
2. [Shared Types Strategy (Single Source of Truth)](#2-shared-types-strategy)
3. [State Management en Frontend (Next.js + Vercel)](#3-state-management-frontend)
4. [PostgreSQL: Optimización, Mantenimiento y Scripts](#4-postgresql)
5. [Convenciones y Nomenclaturas](#5-convenciones-y-nomenclaturas)
6. [Code Smells & Reglas de Código Limpio](#6-code-smells)
7. [Logging Consistente con Reglas de Negocio](#7-logging)
8. [Migraciones y Gestión del Schema](#8-migraciones)
9. [Paginación y Data Fetching Patterns](#9-paginación)
10. [RBAC: Roles Fijos (No Customizables)](#10-rbac)
11. [TTL y Hashing de Keys](#11-ttl-hashing)
12. [Skills y Herramientas de Productividad](#12-skills)
13. [Documentación y Diagramas](#13-documentación)

---

## 1. Paradigma de Programación

### Posición: Funcional-First, Clases Solo Donde Agregan Valor

No es funcional puro. No es OOP puro. La regla es:

| Contexto                                                                   | Paradigma                 | Razón                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lógica de dominio** (services, state machines, validators, transformers) | **Funcional**             | Funciones puras, composables, testeables sin setup. `pipe()`, `map()`, `filter()`, `reduce()`.                                                          |
| **Infraestructura** (error classes, DI container, adapters con estado)     | **Clases**                | `AppError extends Error` necesita herencia. Adapters que mantienen conexiones (Prisma client, Supabase client) se modelan mejor como clases/singletons. |
| **React components**                                                       | **Funcional** (hooks)     | Next.js App Router es function-first. No class components.                                                                                              |
| **Repositories**                                                           | **Funciones** (no clases) | Un repository es un namespace de funciones que comparten la misma dependencia (prisma). No necesita `this`.                                             |

### Reglas concretas

```typescript
// ✅ CORRECTO — Service como funciones con DI por parámetro
const createEchelonService = (deps: { repo: EchelonRepository; audit: AuditService }) => ({
  findById: (id: string): Promise<Result<Echelon, AppError>> => { ... },
  transition: (id: string, event: EchelonEvent): Promise<Result<Echelon, AppError>> => { ... },
});

// ❌ INCORRECTO — Clase innecesaria
class EchelonService {
  constructor(private repo: EchelonRepository) {}
  findById(id: string) { ... }
}

// ✅ CORRECTO — AppError como clase (necesita herencia + instanceof)
class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    message: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// ✅ CORRECTO — Repository como factory de funciones
const createEchelonRepository = (prisma: PrismaClient) => ({
  findById: (id: string) => prisma.echelon.findUnique({ where: { id } }),
  findByOrg: (orgId: string, cursor?: string) => { ... },
  update: (id: string, data: Partial<Echelon>, version: number) => { ... },
});
```

### No Loops, Yes Declarative

```typescript
// ❌ PROHIBIDO — Loops imperativos
for (let i = 0; i < items.length; i++) { ... }
for (const item of items) { ... }
while (condition) { ... }

// ✅ CORRECTO — Declarativo con Array methods
const activeEchelons = echelons
  .filter(isActive)
  .map(toEchelonDTO)
  .sort(byCreatedAtDesc);

// ✅ CORRECTO — Promise.all para paralelismo
const [companies, products, echelons] = await Promise.all([
  companyRepo.findByOrg(orgId),
  productRepo.findByOrg(orgId),
  echelonRepo.findByOrg(orgId),
]);

// ✅ CORRECTO — Promise.allSettled cuando no quiero que uno falle y rompa todo
const results = await Promise.allSettled(
  devices.map(d => deviceService.validate(d.machineId))
);
const succeeded = results.filter(isFulfilled).map(r => r.value);
const failed = results.filter(isRejected).map(r => r.reason);

// ✅ CORRECTO — reduce para acumuladores (pero solo cuando es claro)
const totalCost = usageRecords.reduce((sum, r) => sum + r.costUsd, 0);

// ❌ PROHIBIDO — forEach con side effects ocultos
items.forEach(item => { globalState.push(transform(item)); });

// ✅ CORRECTO — Si necesitás side effects, sé explícito
const transformed = items.map(transform);
globalState = [...globalState, ...transformed];
```

### Excepciones permitidas para loops

- `for await...of` para iterating streams (Vercel AI SDK streaming)
- `while` en retry logic con backoff (infraestructura, no dominio)
- **Excepción por legibilidad (code review):** si en un algoritmo concreto (p. ej. recorrido con estado, grafos, FSM con muchos estados) un `for` o `while` es claramente más legible que el equivalente declarativo (`reduce` anidado, etc.), se permite con **comentario que justifique** y aprobación en code review. La regla por defecto sigue siendo declarativo.

---

## 2. Shared Types Strategy

### Problema que resolvemos

Sin estrategia, terminás con:

- `src/types/api.ts` (tipos de respuesta)
- `src/types/domain.ts` (tipos de dominio)
- `src/types/database.ts` (tipos de Prisma)
- `src/modules/echelon/echelon.types.ts` (tipos del módulo)
- `src/components/echelon/echelon-form.tsx` (re-tipando el form)
- `src/app/api/v1/echelons/route.ts` (re-tipando el request)

6 archivos para tipar la misma entidad. **Inaceptable.**

### Single Source of Truth: Prisma → Zod → Infer

```
prisma/schema.prisma (modelo)
    ↓ prisma generate
@prisma/client types (generated, read-only)
    ↓ import
src/schemas/ (Zod schemas, uno por entidad)
    ↓ z.infer<typeof schema>
TypeScript types (inferidos, zero duplicación)
    ↓ import
Route Handlers + Server Actions + Components
```

### Estructura de archivos

```
src/
├── schemas/                          # ÚNICO LUGAR donde se definen shapes
│   ├── company.schema.ts             # Zod schemas para Company
│   ├── product.schema.ts
│   ├── echelon.schema.ts
│   ├── session.schema.ts
│   ├── summary.schema.ts
│   ├── device.schema.ts
│   ├── usage.schema.ts
│   ├── user.schema.ts
│   └── shared.schema.ts             # Pagination, API response, common fields
```

### Ejemplo concreto

```typescript
// src/schemas/echelon.schema.ts — SINGLE SOURCE OF TRUTH
import { z } from 'zod';
import { paginationSchema, uuidSchema } from './shared.schema';

// --- Enums (match Prisma enums) ---
export const EchelonState = z.enum(['OPEN', 'IN_PROGRESS', 'CLOSING', 'CLOSURE_REVIEW', 'CLOSED']);
export type EchelonState = z.infer<typeof EchelonState>;

export const EchelonType = z.enum(['PM', 'UX', 'DEV', 'ARCHITECTURE']);
export type EchelonType = z.infer<typeof EchelonType>;

// --- Base shape (lo que existe en DB) ---
export const echelonBaseSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(255),
  state: EchelonState,
  type: EchelonType,
  configBlueprint: z.record(z.unknown()).nullable(),
  version: z.number().int().positive(),
  productId: uuidSchema,
  organizationId: uuidSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});
export type Echelon = z.infer<typeof echelonBaseSchema>;

// --- API Input schemas ---
export const createEchelonSchema = echelonBaseSchema
  .pick({
    name: true,
    type: true,
    productId: true,
  })
  .extend({
    configBlueprint: z.record(z.unknown()).optional(),
  });
export type CreateEchelonInput = z.infer<typeof createEchelonSchema>;

export const updateEchelonSchema = createEchelonSchema.partial().extend({
  version: z.number().int().positive(), // Required for optimistic locking
});
export type UpdateEchelonInput = z.infer<typeof updateEchelonSchema>;

// --- API Output schemas ---
export const echelonResponseSchema = echelonBaseSchema.extend({
  readyToClose: z.boolean(),
  sessionsCount: z.number().int(),
  requiredFieldsProgress: z.object({
    total: z.number().int(),
    met: z.number().int(),
  }),
});
export type EchelonResponse = z.infer<typeof echelonResponseSchema>;

// --- Query schemas ---
export const echelonListQuerySchema = paginationSchema.extend({
  state: EchelonState.optional(),
  productId: uuidSchema.optional(),
  type: EchelonType.optional(),
});
export type EchelonListQuery = z.infer<typeof echelonListQuerySchema>;
```

```typescript
// src/app/api/v1/echelons/route.ts — USA los schemas, no define tipos propios
import { createEchelonSchema, echelonListQuerySchema } from '@/schemas/echelon.schema';
import { compose, withAuth, withTenant, withValidation } from '@/lib/middleware';

export const POST = compose(
  withAuth,
  withTenant,
  withValidation({ body: createEchelonSchema }),
)(async (req, ctx) => {
  // ctx.validated.body es tipo CreateEchelonInput — inferido, no declarado
  const result = await echelonService.create(ctx.validated.body, ctx.organizationId);
  // ...
});
```

```typescript
// src/components/forms/echelon-form.tsx — USA el mismo schema
import { createEchelonSchema, type CreateEchelonInput } from '@/schemas/echelon.schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export const EchelonForm = ({ onSubmit }: { onSubmit: (data: CreateEchelonInput) => void }) => {
  const form = useForm<CreateEchelonInput>({
    resolver: zodResolver(createEchelonSchema),
  });
  // ...
};
```

### Reglas

1. **Nunca crear un `type` o `interface` manual para una entidad de dominio.** Todo se infiere de Zod.
2. **`src/schemas/*.schema.ts`** es el único lugar donde se definen shapes.
3. **Prisma generated types** (`@prisma/client`) se usan solo en repositories. Nunca en components o route handlers.
4. **Si necesitás un tipo derivado**, crealo como `.pick()`, `.omit()`, `.extend()` o `.partial()` del schema base.
5. **`src/types/`** solo para tipos utilitarios que no son entidades: `Result<T,E>`, `PaginatedResponse<T>`, `ApiResponse<T>`.

### Eliminamos

- ~~`src/types/api.ts`~~ → inferido de schemas
- ~~`src/types/database.ts`~~ → Prisma generated (no re-exportar)
- ~~`src/types/domain.ts`~~ → inferido de schemas
- ~~`src/modules/*/types.ts`~~ → cada módulo importa de `src/schemas/`

---

## 3. State Management Frontend

### Posición: Next.js App Router elimina el 80% del state management tradicional

No necesitás Redux, Zustand para datos del servidor, ni context providers masivos. Next.js App Router con RSC + Server Actions + TanStack Query cubre todo.

### Capas de estado

```
┌─────────────────────────────────────────────────┐
│  Server State (80% del estado de la app)        │
│  ┌─────────────────────────────────────────────┐│
│  │  RSC (React Server Components)              ││
│  │  → Data fetching en el server               ││
│  │  → No shipping JS al client                 ││
│  │  → Cache automático por Next.js             ││
│  │  → Ideal para: listas, detail views,        ││
│  │    dashboards, datos estáticos              ││
│  └─────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │  Server Actions                             ││
│  │  → Mutations del frontend                   ││
│  │  → `'use server'` directive                 ││
│  │  → revalidatePath/revalidateTag post-mutate ││
│  │  → Ideal para: forms, state transitions,    ││
│  │    approve/reject workflows                 ││
│  └─────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │  TanStack Query (solo donde RSC no alcanza) ││
│  │  → Polling/refetching de datos activos      ││
│  │  → Optimistic updates                       ││
│  │  → Supabase Realtime integration            ││
│  │  → Ideal para: budget live, echelon state   ││
│  │    changes, realtime notifications          ││
│  └─────────────────────────────────────────────┘│
├─────────────────────────────────────────────────┤
│  Client State (20% — UI state only)            │
│  ┌─────────────────────────────────────────────┐│
│  │  React useState/useReducer (component-local)││
│  │  → Form state (RHF maneja esto)             ││
│  │  → Modal open/close                         ││
│  │  → Accordion/tab state                      ││
│  │  → Tooltip/dropdown visibility              ││
│  └─────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │  Zustand (cross-component UI state)         ││
│  │  → Sidebar collapsed state                  ││
│  │  → Theme preference (dark/light)            ││
│  │  → Toast queue                              ││
│  │  → Command palette open                     ││
│  │  → NO datos del servidor                    ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Reglas

1. **Dato del server → RSC primero.** Si la página puede renderear en el server, no usar TanStack Query.
2. **Mutation → Server Action primero.** Forms y acciones que mutan datos van con Server Actions + `revalidatePath`.
3. **TanStack Query solo para**: datos que necesitan polling, optimistic updates, o Supabase Realtime listeners.
4. **Zustand solo para UI state** que cruza componentes y no es dato del servidor.
5. **Nunca** meter datos de API en Zustand. Eso es anti-pattern en App Router.
6. **No `useEffect` para data fetching.** RSC o TanStack Query.
7. **No `useContext` para datos globales.** RSC para server data, Zustand para UI state.

### TanStack Query — Convenciones

```typescript
// src/hooks/queries/use-echelons.ts

// Query key factory — consistente, typesafe
export const echelonKeys = {
  all: ['echelons'] as const,
  lists: () => [...echelonKeys.all, 'list'] as const,
  list: (filters: EchelonListQuery) => [...echelonKeys.lists(), filters] as const,
  details: () => [...echelonKeys.all, 'detail'] as const,
  detail: (id: string) => [...echelonKeys.details(), id] as const,
};

// Hook
export const useEchelons = (filters: EchelonListQuery) =>
  useQuery({
    queryKey: echelonKeys.list(filters),
    queryFn: () => api.echelons.list(filters),
    staleTime: 5_000, // 5s — dato activo
  });

export const useEchelon = (id: string) =>
  useQuery({
    queryKey: echelonKeys.detail(id),
    queryFn: () => api.echelons.get(id),
    staleTime: 5_000,
  });

// Mutation con optimistic update
export const useTransitionEchelon = () =>
  useMutation({
    mutationFn: api.echelons.transition,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: echelonKeys.detail(variables.id) });
      const previous = queryClient.getQueryData(echelonKeys.detail(variables.id));
      queryClient.setQueryData(echelonKeys.detail(variables.id), (old) => ({
        ...old,
        state: variables.targetState,
      }));
      return { previous };
    },
    onError: (_err, variables, context) => {
      queryClient.setQueryData(echelonKeys.detail(variables.id), context?.previous);
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: echelonKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: echelonKeys.lists() });
    },
  });
```

---

## 4. PostgreSQL: Optimización, Mantenimiento y Scripts

### 4.1 Connection Pooling

```
App (Prisma) → Supabase PgBouncer (pool) → PostgreSQL
```

- **Supabase** ya provee PgBouncer en port `6543` (transaction mode).
- **Prisma connection string** usa el pooled URL para queries, direct URL para migrations.
- **`connection_limit=5`** en el connection string — serverless abre pocas conexiones por invocación.
- **`pool_timeout=10`** — si no hay conexión disponible en 10s, error (no hang indefinido).

```env
# .env
DATABASE_URL="postgresql://user:pass@host:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10"
DIRECT_URL="postgresql://user:pass@host:5432/postgres"
```

### 4.2 Query Optimization

**N+1 Prevention (Prisma):**

```typescript
// ❌ N+1 — una query por echelon para obtener sessions
const echelons = await prisma.echelon.findMany();
for (const e of echelons) {
  e.sessions = await prisma.session.findMany({ where: { echelonId: e.id } });
}

// ✅ Prisma include — una sola query con JOIN
const echelons = await prisma.echelon.findMany({
  include: { sessions: true, requiredFields: true },
});

// ✅ Prisma select — solo los campos que necesitás
const echelons = await prisma.echelon.findMany({
  select: { id: true, name: true, state: true, _count: { select: { sessions: true } } },
});
```

**Partial indexes:**

```sql
-- Solo indexar filas activas (soft delete)
CREATE INDEX idx_echelons_active ON echelons(organization_id, state)
  WHERE deleted_at IS NULL;

-- Solo echelons que necesitan atención
CREATE INDEX idx_echelons_open ON echelons(organization_id)
  WHERE state IN ('OPEN', 'IN_PROGRESS') AND deleted_at IS NULL;
```

**EXPLAIN ANALYZE — regla:**
Todo query que toque >1000 filas o se ejecute >10 veces/minuto debe tener un `EXPLAIN ANALYZE` documentado en el PR.

### 4.3 Scripts de Mantenimiento de DB

```
scripts/
├── db-health.ts          # Conexión, tabla sizes, index usage, dead tuples
├── db-analyze.ts         # EXPLAIN ANALYZE de queries críticas
├── db-cleanup.ts         # Hard delete de soft-deleted rows > 90 días
├── db-vacuum.ts          # VACUUM ANALYZE en tablas con alto churn
├── db-backup.ts          # pg_dump a archivo local (free tier)
├── db-seed.ts            # Seed data para dev
└── db-reset.ts           # Drop + recreate + seed (solo dev)
```

**`scripts/db-health.ts`:**

```typescript
// Ejecutar: npx tsx scripts/db-health.ts
// Output: JSON con métricas de salud de la DB

const checks = {
  connectionOk: await testConnection(),
  tableSizes: await query(`
    SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
    FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC
  `),
  indexUsage: await query(`
    SELECT relname, indexrelname, idx_scan, idx_tup_read
    FROM pg_stat_user_indexes ORDER BY idx_scan ASC LIMIT 20
  `), // Indexes con 0 scans = candidatos a eliminar
  deadTuples: await query(`
    SELECT relname, n_dead_tup, last_vacuum, last_autovacuum
    FROM pg_stat_user_tables WHERE n_dead_tup > 1000
  `),
  slowQueries: await query(`
    SELECT query, calls, mean_exec_time, total_exec_time
    FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10
  `), // Requiere extension pg_stat_statements
  cacheHitRatio: await query(`
    SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
    FROM pg_statio_user_tables
  `), // Debe ser > 0.99
  connectionCount: await query(`SELECT count(*) FROM pg_stat_activity`),
  dbSize: await query(`SELECT pg_size_pretty(pg_database_size(current_database()))`),
};
```

**`scripts/db-cleanup.ts`:**

```typescript
// Hard delete de registros soft-deleted hace más de 90 días
// Ejecutar via pg_cron semanal o manualmente

const TABLES_WITH_SOFT_DELETE = [
  'echelons',
  'sessions',
  'executive_summaries',
  'companies',
  'products',
  'devices',
  'attachments',
  'required_fields',
];

for (const table of TABLES_WITH_SOFT_DELETE) {
  const { count } = await prisma.$executeRawUnsafe(`
    DELETE FROM ${table} WHERE deleted_at < NOW() - INTERVAL '90 days'
  `);
  logger.info({ table, deletedCount: count }, 'Hard delete completed');
}

// Cleanup de idempotency keys expirados
await prisma.idempotencyKey.deleteMany({
  where: { expiresAt: { lt: new Date() } },
});

// Cleanup de audit logs > 1 año (configurable)
await prisma.auditLog.deleteMany({
  where: { createdAt: { lt: subYears(new Date(), 1) } },
});
```

### 4.4 pg_cron Jobs (Supabase)

```sql
-- Habilitar extensión (una vez)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup idempotency keys cada hora
SELECT cron.schedule('cleanup-idempotency', '0 * * * *',
  $$DELETE FROM idempotency_keys WHERE expires_at < NOW()$$
);

-- Cleanup soft deletes semanalmente (domingos 3am)
SELECT cron.schedule('hard-delete-old', '0 3 * * 0',
  $$DELETE FROM echelons WHERE deleted_at < NOW() - INTERVAL '90 days'$$
);

-- VACUUM ANALYZE semanal en tablas de alto churn
SELECT cron.schedule('vacuum-high-churn', '0 4 * * 0',
  $$VACUUM ANALYZE usage_records, audit_logs, sessions$$
);

-- Actualizar estadísticas de query planner diariamente
SELECT cron.schedule('analyze-all', '0 2 * * *',
  $$ANALYZE$$
);
```

---

## 5. Convenciones y Nomenclaturas

### 5.1 Files & Directories

| Tipo                  | Convención                                    | Ejemplo                                                   |
| --------------------- | --------------------------------------------- | --------------------------------------------------------- |
| Archivos TS (general) | `kebab-case`                                  | `echelon-state-machine.ts`                                |
| React components      | `kebab-case` (archivo), `PascalCase` (export) | `echelon-form.tsx` → `export const EchelonForm`           |
| Schemas               | `*.schema.ts`                                 | `echelon.schema.ts`                                       |
| Services              | `*.service.ts`                                | `echelon.service.ts`                                      |
| Repositories          | `*.repository.ts`                             | `echelon.repository.ts`                                   |
| Hooks                 | `use-*.ts`                                    | `use-echelons.ts`                                         |
| Tests                 | `*.test.ts` / `*.spec.ts`                     | `echelon.service.test.ts` (unit), `echelon.spec.ts` (e2e) |
| Constants             | `*.constants.ts`                              | `error-codes.constants.ts`                                |
| Directorios           | `kebab-case`                                  | `decision-link/`                                          |

### 5.2 TypeScript

| Tipo                   | Convención                 | Ejemplo                                        |
| ---------------------- | -------------------------- | ---------------------------------------------- |
| Types/Interfaces       | `PascalCase`               | `EchelonResponse`, `CreateEchelonInput`        |
| Enums (Zod)            | `PascalCase`               | `EchelonState`, `EchelonType`                  |
| Functions              | `camelCase`                | `createEchelonService`, `findById`             |
| Constants              | `SCREAMING_SNAKE_CASE`     | `MAX_RETRIES`, `DEFAULT_PAGE_SIZE`             |
| Variables              | `camelCase`                | `echelonState`, `totalCost`                    |
| Boolean variables      | `is/has/can/should` prefix | `isActive`, `hasPermission`, `canClose`        |
| Factory functions      | `create*` prefix           | `createEchelonService`, `createCompanyFactory` |
| Predicates             | `is/has` prefix            | `isActive(e)`, `hasRequiredFieldsMet(e)`       |
| Transformers           | `to*` prefix               | `toEchelonDTO(e)`, `toApiResponse(data)`       |
| Event handlers (React) | `handle*` / `on*` (prop)   | `handleSubmit`, `onSuccess`                    |
| Query keys             | noun-based array           | `['echelons', 'list', filters]`                |

### 5.3 Database (Postgres/Prisma)

| Tipo              | Convención              | Ejemplo                         |
| ----------------- | ----------------------- | ------------------------------- |
| Tablas (Postgres) | `snake_case`, plural    | `echelons`, `required_fields`   |
| Columnas          | `snake_case`            | `organization_id`, `created_at` |
| Prisma models     | `PascalCase`, singular  | `Echelon`, `RequiredField`      |
| Prisma @@map      | snake_case plural       | `@@map("required_fields")`      |
| Foreign keys      | `{entity}_id`           | `product_id`, `session_id`      |
| Indexes           | `idx_{table}_{columns}` | `idx_echelons_org_state`        |
| Enums (Postgres)  | `PascalCase`            | `EchelonState`, `UserRole`      |

### 5.4 API

| Tipo           | Convención             | Ejemplo                                          |
| -------------- | ---------------------- | ------------------------------------------------ |
| Endpoints      | `kebab-case`, plural   | `/api/v1/required-fields`                        |
| Path params    | `camelCase`            | `/echelons/:echelonId/sessions/:sessionId`       |
| Query params   | `camelCase`            | `?pageSize=20&sortBy=createdAt`                  |
| Request body   | `camelCase`            | `{ "productId": "uuid", "configBlueprint": {} }` |
| Response body  | `camelCase`            | `{ "data": { "readyToClose": true } }`           |
| Error codes    | `SCREAMING_SNAKE_CASE` | `ECHELON_INVALID_TRANSITION`                     |
| Headers custom | `X-PascalCase-Kebab`   | `X-Request-Id`, `X-RateLimit-Remaining`          |

### 5.5 Git

| Tipo            | Convención               | Ejemplo                                             |
| --------------- | ------------------------ | --------------------------------------------------- |
| Branch names    | `type/short-description` | `feat/echelon-state-machine`, `fix/rls-policy-leak` |
| Commit messages | Conventional Commits     | `feat(echelon): add consolidation endpoint`         |
| PR titles       | Same as commits          | `feat(echelon): add consolidation endpoint`         |
| Release tags    | Semver                   | `v1.0.0`, `v1.1.0-beta.1`                           |

---

## 6. Code Smells & Reglas de Código Limpio

### Prohibiciones absolutas (ESLint enforced)

| Smell                      | Regla                           | Enforcement                                                                                    |
| -------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `any`                      | Zero tolerance                  | `@typescript-eslint/no-explicit-any: error`                                                    |
| `as` type assertions       | Prohibido fuera de tests        | `@typescript-eslint/consistent-type-assertions: error` (con `assertionStyle: 'never'` en src/) |
| `console.log/warn/error`   | Todo va por pino logger         | `no-console: error`                                                                            |
| Nested ternaries           | Unreadable                      | `no-nested-ternary: error`                                                                     |
| Magic numbers              | Extraer a constantes con nombre | `no-magic-numbers: warn` (excluir 0, 1, -1)                                                    |
| Deep nesting (>3 levels)   | Early return                    | `max-depth: ['warn', 3]`                                                                       |
| Long functions (>50 lines) | Extraer sub-funciones           | `max-lines-per-function: ['warn', { max: 50 }]` (excluir tests)                                |
| Cyclomatic complexity >10  | Simplificar lógica              | `complexity: ['warn', 10]`                                                                     |
| Dead code                  | Eliminar, no comentar           | `no-unused-vars: error`, `no-unreachable: error`                                               |
| God objects                | Módulos enfocados               | Code review (no automatizable)                                                                 |
| Implicit boolean coercion  | Explícito                       | `@typescript-eslint/strict-boolean-expressions: error`                                         |
| Non-null assertion `!`     | Prohibido                       | `@typescript-eslint/no-non-null-assertion: error`                                              |
| Parameter mutation         | Parámetros son immutables       | `@typescript-eslint/prefer-readonly-parameter-types: warn`                                     |

### Reglas de buen código (code review)

```typescript
// ❌ SMELL: función que hace demasiado
async function handleEchelonConsolidate(echelonId: string) {
  const echelon = await prisma.echelon.findUnique({ where: { id: echelonId } });
  if (echelon.state !== 'IN_PROGRESS') throw new Error('invalid');
  const sessions = await prisma.session.findMany({ where: { echelonId } });
  const summaries = sessions.flatMap((s) => s.summaries).filter((s) => s.state === 'VALIDATED');
  const report = await callLLM(summaries);
  await prisma.echelon.update({ where: { id: echelonId }, data: { state: 'CLOSING' } });
  await prisma.executiveSummary.create({ data: { content: report, type: 'CONSOLIDATION' } });
  await sendEmail(echelon.ownerId, 'consolidation-ready');
}

// ✅ CLEAN: cada función hace UNA cosa
const consolidateEchelon = async (
  echelonId: string,
  deps: ConsolidationDeps,
): Promise<Result<ConsolidationResult, AppError>> => {
  const echelon = await deps.echelonRepo.findById(echelonId);
  if (!echelon.ok) return echelon;

  const transitionResult = echelonStateMachine.transition(echelon.value.state, 'CONSOLIDATE');
  if (!transitionResult.ok) return transitionResult;

  const summaries = await deps.summaryRepo.findValidatedByEchelon(echelonId);
  if (!summaries.ok) return summaries;

  const report = await deps.consolidationEngine.generate(summaries.value);
  if (!report.ok) return report;

  return deps.echelonRepo.updateWithConsolidation(echelonId, {
    state: transitionResult.value,
    consolidationReport: report.value,
    version: echelon.value.version,
  });
};
```

### Early return pattern

```typescript
// ❌ Pyramid of doom
const processRequest = async (req) => {
  if (req.user) {
    if (req.user.role === 'ADMIN') {
      if (req.body.echelonId) {
        const echelon = await findEchelon(req.body.echelonId);
        if (echelon) {
          // finally do something...
        }
      }
    }
  }
};

// ✅ Early return — flat, readable
const processRequest = async (req) => {
  if (!req.user) return err(unauthorized());
  if (req.user.role !== 'ADMIN') return err(forbidden());
  if (!req.body.echelonId) return err(badRequest('echelonId required'));

  const echelon = await findEchelon(req.body.echelonId);
  if (!echelon.ok) return echelon;

  // do something with flat, confident context
};
```

---

## 7. Logging Consistente con Reglas de Negocio

### Principio

Cada log debe responder: **quién, qué, sobre qué, resultado, cuánto tardó.**

### Niveles y cuándo usarlos

| Level   | Cuándo                                 | Ejemplo                                           |
| ------- | -------------------------------------- | ------------------------------------------------- |
| `error` | Operación falló y no se pudo recuperar | `echelon.transition failed: INVALID_TRANSITION`   |
| `warn`  | Situación anómala pero recuperable     | `budget threshold 80% crossed for org X`          |
| `info`  | Evento de negocio significativo        | `echelon CLOSED, triggered integration`           |
| `debug` | Detalle técnico para troubleshooting   | `cache miss for context bundle, fetching from DB` |

### Domain Events que SIEMPRE se loguean (info)

```typescript
// Estos son los eventos de negocio críticos. Si no aparecen en logs, el sistema no está funcionando.

// Auth & Identity
'auth.login.success'; // { userId, ip, userAgent }
'auth.login.failed'; // { ip, reason, userAgent }
'auth.device.enrolled'; // { userId, machineId, os }
'auth.device.revoked'; // { userId, machineId, revokedBy }
'auth.device.validated'; // { machineId, organizationId }

// Echelon Lifecycle
'echelon.created'; // { echelonId, productId, type }
'echelon.transitioned'; // { echelonId, from, to, triggeredBy }
'echelon.consolidation.started'; // { echelonId, summaryCount }
'echelon.consolidation.completed'; // { echelonId, durationMs, tokenCount }
'echelon.closed'; // { echelonId, integrationTriggered }

// Sessions & Summaries
'session.created'; // { sessionId, echelonId }
'summary.received'; // { summaryId, sessionId, machineId }
'summary.validated'; // { summaryId, validatedBy }
'summary.state.changed'; // { summaryId, from, to }

// Budget
'budget.usage.recorded'; // { organizationId, costUsd, provider, model }
'budget.threshold.crossed'; // { organizationId, threshold, currentTotal }
'budget.limit.reached'; // { organizationId, limit, currentTotal }

// Integration
'integration.triggered'; // { echelonId, strategy, jobId }
'integration.pdf.generated'; // { echelonId, attachmentId, sizeBytes }
'integration.email.sent'; // { templateId, recipientCount }

// System
'job.dispatched'; // { jobType, jobId }
'job.completed'; // { jobType, jobId, durationMs }
'job.failed'; // { jobType, jobId, error, attempt }
'job.dead_letter'; // { jobType, jobId, error }
'cache.hit'; // { layer, key }
'cache.miss'; // { layer, key }
```

### Formato

```typescript
// Toda llamada a logger incluye el módulo de origen y el evento de negocio
logger.info(
  {
    event: 'echelon.transitioned',
    echelonId: echelon.id,
    from: previousState,
    to: newState,
    triggeredBy: userId,
    durationMs: elapsed,
    organizationId,
  },
  'Echelon state transitioned from %s to %s',
  previousState,
  newState,
);
```

### Reglas

1. **Todo log `info` tiene un `event` key.** Parseable, queryable, alertable.
2. **Todo log `error` tiene `error.code`, `error.message`, y `requestId`.**
3. **Nunca loguear**: passwords, tokens, API keys, PII (email, phone). Pino redaction config lo enforce.
4. **Nunca loguear** request/response bodies completos. Solo campos relevantes.
5. **Siempre incluir** `requestId`, `userId`, `organizationId` via `AsyncLocalStorage` context.
6. **Duration**: toda operación que toque DB, external service, o LLM loguea `durationMs`.

---

## 8. Migraciones y Gestión del Schema

### Workflow de migraciones

```
1. Modificar prisma/schema.prisma
2. npx prisma migrate dev --name descriptive-name
3. Verificar SQL generado en prisma/migrations/
4. Si necesita RLS → agregar SQL manual en supabase/migrations/
5. Commit: "feat(db): add required_fields table"
6. CI: prisma migrate deploy (antes del deploy de la app)
```

### Reglas

1. **Forward-only.** No hay `down` migrations en producción. Si algo salió mal → nueva migration que corrige.
2. **Naming**: `YYYYMMDDHHMMSS_descriptive_name` (Prisma lo genera automático).
3. **Breaking changes** requieren multi-step:
   - Step 1: Add new column/table (deploy)
   - Step 2: Migrate data (script)
   - Step 3: Update app code to use new column
   - Step 4: Remove old column (new migration)
4. **Never alter column types directly.** Add new → migrate → remove old.
5. **RLS policies** van en `supabase/migrations/`, separadas de Prisma.
6. **Indexes** se agregan en migraciones específicas con `CREATE INDEX CONCURRENTLY` (no bloquea la tabla).
7. **Toda migration se revisa manualmente** antes del commit. Prisma puede generar SQL subóptimo.

### Schema validation en CI

```yaml
# .github/workflows/ci.yml
- name: Validate Prisma schema
  run: npx prisma validate

- name: Check for pending migrations
  run: npx prisma migrate diff --from-migrations-directory prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
```

---

## 9. Paginación y Data Fetching Patterns

### Cursor-based Pagination (no offset)

**Offset es prohibido.** Razones:

- `OFFSET 10000` hace un sequential scan de 10000 filas y las descarta.
- Resultados inconsistentes si se insertan/eliminan filas entre páginas.
- Performance degrada linealmente con el offset.

**Cursor es obligatorio:**

```typescript
// src/schemas/shared.schema.ts
export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(), // ID del último item de la página anterior
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// src/lib/utils/pagination.ts
export const paginate = async <T extends { id: string }>(
  query: (args: PaginateArgs) => Promise<T[]>,
  params: PaginationParams,
): Promise<PaginatedResponse<T>> => {
  const items = await query({
    take: params.limit + 1, // +1 para saber si hay más
    ...(params.cursor && {
      skip: 1,
      cursor: { id: params.cursor },
    }),
    orderBy: { [params.sortBy]: params.sortOrder },
  });

  const hasMore = items.length > params.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return { data, meta: { nextCursor, hasMore, limit: params.limit } };
};
```

### Data Fetching Patterns

```typescript
// Pattern 1: RSC (Server Component) — para páginas con datos iniciales
// app/(dashboard)/echelons/page.tsx
export default async function EchelonsPage({ searchParams }: Props) {
  const filters = echelonListQuerySchema.parse(await searchParams);
  const result = await echelonService.list(filters, getOrgId());

  return <EchelonsList initialData={result} filters={filters} />;
}

// Pattern 2: TanStack Query — para datos que se actualizan en el cliente
// components/echelon/echelons-list.tsx (Client Component)
'use client';
export const EchelonsList = ({ initialData, filters }) => {
  const { data, isLoading } = useEchelons(filters, { initialData });
  // ...
};

// Pattern 3: Server Action — para mutations
// app/(dashboard)/echelons/actions.ts
'use server';
export const createEchelon = async (formData: CreateEchelonInput) => {
  const result = await echelonService.create(formData, getOrgId());
  if (!result.ok) return { error: result.error.message };
  revalidateTag('echelons');
  return { data: result.value };
};

// Pattern 4: Parallel data loading en RSC
export default async function EchelonDetailPage({ params }: Props) {
  const { id } = await params;
  const [echelon, sessions, requiredFields] = await Promise.all([
    echelonService.findById(id),
    sessionService.findByEchelon(id),
    requiredFieldService.findByEchelon(id),
  ]);
  // ...
};
```

---

## 10. RBAC: Roles Fijos (No Customizables)

### Decisión: Enum hardcoded. No ABAC dinámico.

**Razones:**

- RBAC dinámico (tablas `permissions`, `role_permissions`, UI de gestión) es una feature completa que requiere ~2 semanas de desarrollo.
- Para MVP con 1 dev, los 5 roles cubren todos los use cases del documento.
- Post-MVP: si una empresa necesita roles custom → migrar a CASL.js (ABAC) o custom permission engine.

### Matriz de permisos

```typescript
// src/lib/rbac/permissions.ts
export const PERMISSIONS = {
  // Organization
  'org:read': ['SUPER_ADMIN', 'ADMIN'],
  'org:write': ['SUPER_ADMIN'],
  'org:delete': ['SUPER_ADMIN'],

  // Members
  'member:invite': ['SUPER_ADMIN', 'ADMIN'],
  'member:remove': ['SUPER_ADMIN', 'ADMIN'],
  'member:role': ['SUPER_ADMIN', 'ADMIN'],

  // Companies
  'company:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
  'company:write': ['SUPER_ADMIN', 'ADMIN'],
  'company:delete': ['SUPER_ADMIN', 'ADMIN'],

  // Products
  'product:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
  'product:write': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'product:delete': ['SUPER_ADMIN', 'ADMIN'],

  // Echelons
  'echelon:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
  'echelon:write': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'echelon:delete': ['SUPER_ADMIN', 'ADMIN'],
  'echelon:launch': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER'],
  'echelon:consolidate': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'echelon:close': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],

  // Sessions & Summaries
  'session:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
  'session:write': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER'],
  'summary:validate': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'summary:edit': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER'],

  // Devices
  'device:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'device:enroll': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER'],
  'device:revoke': ['SUPER_ADMIN', 'ADMIN'],

  // Budget & Audit
  'budget:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'],
  'audit:read': ['SUPER_ADMIN', 'ADMIN'],

  // Settings
  'settings:read': ['SUPER_ADMIN', 'ADMIN'],
  'settings:write': ['SUPER_ADMIN', 'ADMIN'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const hasPermission = (role: UserRole, permission: Permission): boolean =>
  PERMISSIONS[permission].includes(role);
```

### Uso en middleware

```typescript
// src/lib/middleware/with-permission.ts
export const withPermission = (permission: Permission) =>
  (handler: RouteHandler) => async (req: NextRequest, ctx: RouteContext) => {
    const userRole = ctx.user.role;
    if (!hasPermission(userRole, permission)) {
      return apiError(forbidden(`Role ${userRole} lacks permission ${permission}`));
    }
    return handler(req, ctx);
  };

// Uso:
export const DELETE = compose(
  withAuth,
  withTenant,
  withPermission('company:delete'),
)(async (req, ctx) => { ... });
```

---

## 11. TTL y Hashing de Keys

### Idempotency Keys

| Propiedad | Valor                                                |
| --------- | ---------------------------------------------------- |
| TTL       | 24 horas                                             |
| Hash      | UUID v4 generado por el cliente (Assistant)          |
| Storage   | Tabla `idempotency_keys` en Postgres                 |
| Cleanup   | pg_cron cada hora: `DELETE WHERE expires_at < NOW()` |

### Cache Keys (Vercel KV)

| Key pattern                       | TTL                         | Invalidación                                 |
| --------------------------------- | --------------------------- | -------------------------------------------- |
| `ctx:{echelonId}:{version}`       | 5 min                       | On summary validated, required field changed |
| `rl:{userId}:{endpoint}:{window}` | Según window del rate limit | Auto-expire                                  |
| `rl:{ip}:{endpoint}:{window}`     | Según window                | Auto-expire                                  |
| `session:{token}`                 | 1 hora                      | On logout, device revoke                     |

### JWT Tokens

| Token                   | TTL    | Refresh               |
| ----------------------- | ------ | --------------------- |
| Access token (Supabase) | 1 hora | Via refresh token     |
| Refresh token           | 7 días | Re-login required     |
| Device validation token | 15 min | Re-validate machineId |
| Signed URL (Storage)    | 1 hora | Request new URL       |

### API Keys de terceros (cifradas en DB)

| Propiedad        | Valor                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Encryption       | AES-256-GCM                                                      |
| Key derivation   | HKDF from ENCRYPTION_KEY env var                                 |
| Rotation         | Admin UI → new key → 24h grace period → old key invalidated      |
| Hash para lookup | SHA-256 del key (no almacenar plaintext ni siquiera como lookup) |

---

## 12. Skills y Herramientas de Productividad

### Herramientas para acelerar el desarrollo

| Herramienta                 | Uso                                                                            | Cuándo                                                                              |
| --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **v0.dev**                  | Generar scaffolding de componentes UI (DataTables, Forms, Layouts, Dashboards) | Fase 5: Frontend. Cada pantalla empieza con un prompt en v0 → cleanup → integración |
| **Cursor / Claude**         | Code generation, refactoring, test writing                                     | Todo el desarrollo. Skills configurables para patterns del proyecto                 |
| **Prisma Studio**           | Visual DB browser                                                              | Dev: explorar datos, debug queries                                                  |
| **Supabase Dashboard**      | DB management, RLS testing, Auth management, Storage browser                   | Dev + Staging                                                                       |
| **Postman / Hoppscotch**    | API testing manual                                                             | Desarrollo de endpoints, antes de escribir tests                                    |
| **React DevTools**          | Component tree, props inspection                                               | Debug frontend                                                                      |
| **TanStack Query DevTools** | Query cache inspection, refetch triggers                                       | Debug data fetching                                                                 |

### Claude Code Skills (`.claude/` config)

Podemos definir skills/snippets que el asistente de código conozca para mantener consistencia:

```markdown
# Skill: Crear nuevo módulo

Cuando se pida crear un módulo nuevo (ej: "crear módulo de notifications"):

1. Crear schema en src/schemas/{module}.schema.ts (Zod, inferir tipos)
2. Crear src/modules/{module}/{module}.repository.ts (factory function)
3. Crear src/modules/{module}/{module}.service.ts (factory function, deps inyectadas)
4. Crear route handlers en src/app/api/v1/{module}/route.ts
5. Crear tests en tests/unit/modules/{module}.service.test.ts
6. Registrar en DI container
7. Agregar permisos en src/lib/rbac/permissions.ts

# Skill: Crear endpoint API

Cuando se pida crear un endpoint:

1. Definir input/output schemas en src/schemas/ (o extender existente)
2. Crear route handler con compose(withAuth, withTenant, withPermission, withValidation)
3. Delegar a service
4. Usar Result pattern para error handling
5. Test: unit para service, integration para route handler

# Skill: Crear componente de página

Cuando se pida crear una página:

1. Crear page.tsx como Server Component (RSC)
2. Fetch data con service directo (no fetch API)
3. loading.tsx con skeleton
4. error.tsx con error boundary
5. Si necesita interactividad → Client Component separado
6. Si necesita realtime → TanStack Query con initial data del RSC

# Skill: Crear migration

Cuando se modifique el schema:

1. Modificar prisma/schema.prisma
2. npx prisma migrate dev --name descriptive-name
3. Revisar SQL generado
4. Si involucra RLS → SQL en supabase/migrations/
5. Si involucra index → CREATE INDEX CONCURRENTLY
6. Actualizar seed si aplica
```

### Generación de componentes — Flujo con v0.dev

```
1. Describir la pantalla en v0.dev (prompt en inglés, output Shadcn/ui)
2. Exportar el código generado
3. Cleanup:
   - Remover datos hardcodeados → conectar a hooks/RSC
   - Ajustar tipos → importar de src/schemas/
   - Ajustar estilos → tokens de tailwind.config.ts
   - Agregar estados: loading (skeleton), empty, error
   - Agregar accessibility: ARIA labels, keyboard nav
4. Integrar con data fetching (RSC o TanStack Query)
5. Agregar tests (Testing Library)
```

---

## 13. Documentación y Diagramas

### Estructura de la carpeta docs/

```
docs/
├── resumen_ejecutivo_Project-Planning_System.md    # Existente
├── DEVELOPMENT_PLAN_MVP.md                          # Plan de desarrollo
├── ENGINEERING_STANDARDS.md                          # Este documento
├── architecture/
│   ├── SYSTEM_ARCHITECTURE.md                       # Diagrama C4 (Context, Container, Component)
│   ├── DATA_MODEL.md                                # ERD completo con Mermaid
│   ├── STATE_MACHINES.md                            # FSMs: Echelon, Summary
│   └── INTEGRATION_CONTRACTS.md                     # OpenAPI + sequence diagrams Backoffice ↔ Assistant
├── adr/                                              # Architecture Decision Records
│   ├── ADR-001-monorepo-nextjs.md
│   ├── ADR-002-supabase-platform.md
│   ├── ADR-003-rls-defense-in-depth.md
│   ├── ADR-004-result-pattern.md
│   ├── ADR-005-pgvector-retrieval.md
│   ├── ADR-006-optimistic-locking.md
│   ├── ADR-007-edge-functions-jobs.md
│   ├── ADR-008-prisma-orm.md
│   ├── ADR-009-idempotency.md
│   ├── ADR-010-structured-logging.md
│   ├── ADR-011-vercel-ai-sdk.md
│   ├── ADR-012-multi-layer-cache.md
│   ├── ADR-013-node22.md
│   └── ADR-014-v0-ui-scaffolding.md
├── api/
│   ├── openapi.json                                  # Generated OpenAPI spec
│   └── ENDPOINTS.md                                  # Human-readable endpoint catalog
├── runbooks/
│   ├── SETUP.md                                      # Setup de dev environment paso a paso
│   ├── DEPLOYMENT.md                                 # Deploy manual y CI/CD
│   ├── DATABASE.md                                   # Migrations, backup, restore, cleanup
│   ├── MONITORING.md                                 # Sentry, Vercel Analytics, alerting
│   └── TROUBLESHOOTING.md                            # Problemas comunes y soluciones
└── diagrams/
    ├── c4-context.mermaid
    ├── c4-container.mermaid
    ├── erd-backoffice.mermaid
    ├── fsm-echelon.mermaid
    ├── fsm-summary.mermaid
    ├── sequence-launch-assistant.mermaid
    ├── sequence-session-lifecycle.mermaid
    ├── sequence-consolidation.mermaid
    └── sequence-device-enrollment.mermaid
```

### Reglas de documentación

1. **Todo ADR se escribe cuando se toma la decisión**, no después. Formato: Context → Decision → Consequences → Status.
2. **Todo diagrama es Mermaid** (versionable en git, renderizable en GitHub/Obsidian/VS Code).
3. **Diagramas se mantienen actualizados.** Si el código cambia un flow → actualizar el diagrama en el mismo PR.
4. **README.md** del root siempre permite a un dev nuevo hacer setup en <15 minutos.
5. **ENDPOINTS.md** se genera parcialmente desde OpenAPI y se enriquece manualmente con ejemplos.
6. **Runbooks** son documentos operacionales: paso a paso para tareas de mantenimiento.
7. **No hay documentación sin dueño.** Cada documento tiene un header con versión, fecha, y scope.

### ADR Template

```markdown
# ADR-XXX: [Título]

**Estado:** Accepted | Superseded by ADR-YYY | Deprecated
**Fecha:** YYYY-MM-DD

## Contexto

[Qué problema estamos resolviendo. Constraints. Fuerzas en juego.]

## Decisión

[Qué decidimos hacer y por qué.]

## Alternativas consideradas

[Qué otras opciones evaluamos y por qué las descartamos.]

## Consecuencias

### Positivas

- ...

### Negativas

- ...

### Riesgos

- ...
```

### Diagramas requeridos (Fase por Fase)

| Fase | Diagrama                               | Tipo                    |
| ---- | -------------------------------------- | ----------------------- |
| 0    | C4 Context (sistema en su entorno)     | Mermaid C4              |
| 0    | C4 Container (componentes de infra)    | Mermaid C4              |
| 1    | ERD completo (todas las entidades)     | Mermaid ER              |
| 2    | FSM Echelon (estados + transiciones)   | Mermaid stateDiagram    |
| 2    | FSM Summary (estados + transiciones)   | Mermaid stateDiagram    |
| 3    | Sequence: Device Enrollment            | Mermaid sequenceDiagram |
| 3    | Sequence: Launch Assistant             | Mermaid sequenceDiagram |
| 3    | Sequence: Session Lifecycle (E2E)      | Mermaid sequenceDiagram |
| 4    | Sequence: Consolidation flow           | Mermaid sequenceDiagram |
| 4    | Sequence: Integration trigger on close | Mermaid sequenceDiagram |
| 6    | Deployment diagram (Vercel + Supabase) | Mermaid C4              |

---

## Referencia rápida: Qué hacer y qué NO hacer

| ✅ Hacer                                                   | ❌ No hacer                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Tipos inferidos de Zod schemas                             | Tipos manuales duplicados                                                            |
| `Result<T,E>` para error handling                          | `try-catch` disperso                                                                 |
| Funciones puras en dominio                                 | Clases para todo                                                                     |
| `Array.map/filter/reduce`                                  | `for`, `forEach`, `while`                                                            |
| `Promise.all` para paralelismo                             | `await` secuencial innecesario                                                       |
| Early return                                               | Nesting >3 niveles                                                                   |
| Constantes con nombre                                      | Magic numbers/strings                                                                |
| Pino logger con event key                                  | `console.log`                                                                        |
| Cursor-based pagination                                    | Offset-based pagination                                                              |
| RSC para data fetching                                     | `useEffect` + `fetch`                                                                |
| Server Actions para mutations                              | `POST` desde el frontend a la API para el mismo app                                  |
| TanStack Query para datos reactivos                        | Zustand/Redux para server state                                                      |
| Soft delete                                                | Hard delete                                                                          |
| Forward-only migrations                                    | Down migrations en prod                                                              |
| Zod validation en boundaries                               | Trust input sin validar                                                              |
| Structured logs JSON                                       | Strings concatenados                                                                 |
| `AsyncLocalStorage` para context                           | Pasar requestId manualmente                                                          |
| Composite indexes parciales                                | Indexes en todas las columnas                                                        |
| `EXPLAIN ANALYZE` en PRs                                   | Queries sin verificar performance                                                    |
| `pnpm build` como Build Command en Vercel                  | `npx prisma generate && next build` (rompe resolución de binarios)                   |
| `pnpm-lock.yaml` siempre commiteado y en sync              | `--no-frozen-lockfile` en CI/CD (rompe determinismo)                                 |
| Sin `output: 'standalone'` al deployar en Vercel           | `output: 'standalone'` en `next.config.ts` para Vercel (causa ENOENT en file tracer) |
| Una sola `page.tsx` por ruta (no duplicar en route groups) | Dos archivos mapeando a la misma ruta (`app/page.tsx` + `app/(group)/page.tsx`)      |

---

## 14. Desvíos y Decisiones de Implementación (Registro Vivo)

Esta sección registra los desvíos respecto al plan original y las decisiones técnicas tomadas durante la implementación. Se actualiza a medida que se descubren nuevas restricciones o se toman decisiones.

| #     | Área                              | Decisión original                               | Decisión real                                                                                        | Razón                                                                                                                                                                                                                                                                                                                              | ADR                 |
| ----- | --------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D-001 | Toolchain                         | Node.js 22.x                                    | **Node 22.22.0** (Volta pin)                                                                         | Volta 2.0.2 como gestor de versiones — reproducibilidad garantizada                                                                                                                                                                                                                                                                | —                   |
| D-002 | Package manager                   | npm/pnpm                                        | **pnpm@9.15.9** (Volta install)                                                                      | Volta no puede pinear pnpm en `volta pin` — se usa `packageManager` en `package.json`                                                                                                                                                                                                                                              | —                   |
| D-003 | Next.js version                   | 15.x                                            | **15.5.10** (upgrade forzado)                                                                        | 15.3.3 tenía 10 CVEs: 1 crítico (RCE flight protocol), 4 high, 5 moderate. Mínimo seguro: 15.5.10                                                                                                                                                                                                                                  | —                   |
| D-004 | Tailwind version                  | Tailwind CSS v4                                 | **Tailwind CSS v3.4.17**                                                                             | v4 no tiene soporte estable con Shadcn/ui al momento de setup. Revisar post-v4-stable                                                                                                                                                                                                                                              | —                   |
| D-005 | ESLint config                     | `.eslintrc.cjs`                                 | **`eslint.config.mjs`** (flat config)                                                                | ESLint 9+ requiere flat config. `@eslint/eslintrc` FlatCompat para compatibilidad con `eslint-config-next` legacy                                                                                                                                                                                                                  | ADR-015 (pendiente) |
| D-006 | `next lint` CLI                   | `next lint` en scripts                          | ⚠️ **Deprecated en Next.js 15.5**                                                                    | `next lint` se elimina en Next.js 16. Migrar a `eslint` CLI directamente cuando se actualice a Next 16                                                                                                                                                                                                                             | —                   |
| D-007 | Supabase client imports           | `createServerClient` de `@supabase/supabase-js` | `createServerClient` de `@supabase/ssr`, `createClient` de `@supabase/supabase-js` para service role | `@supabase/supabase-js` no exporta `createServerClient` — ese pertenece a `@supabase/ssr`                                                                                                                                                                                                                                          | —                   |
| D-008 | Route handlers async              | `async` con `await`                             | Stubs sin `await` en Fase 0                                                                          | Los stubs son `async` por contrato Next.js. `@typescript-eslint/require-await: off` para `src/app/api/**`. Remover per-handler al implementar                                                                                                                                                                                      | —                   |
| D-009 | `RouteContext` type               | `Record<string, unknown>`                       | `{ params: Promise<Record<string, string \| string[]>> }`                                            | Next.js 15 — route params son siempre `Promise`. Contexto de app (userId, orgId) va en `AsyncLocalStorage`, no en el context de Next                                                                                                                                                                                               | —                   |
| D-010 | Prisma version                    | Prisma 6.x                                      | **Prisma 6.8.2** (client 6.19.2)                                                                     | Prisma 7 disponible pero con breaking change (archivo `prisma.config.ts`). Migrar post-MVP. Ignorar deprecation warning del `package.json#prisma`                                                                                                                                                                                  | —                   |
| D-011 | Shadcn/ui style                   | No especificado en plan                         | **"new-york"** (default de `shadcn@3.8.5`)                                                           | El init no expone flag `--style`; asigna "new-york" como default. Es un estilo más moderno/compacto que "default". Compatible con el backoffice. `components.json: "style": "new-york"`                                                                                                                                            | —                   |
| D-012 | Shadcn/ui base color              | No especificado en plan                         | **zinc** (elegido explícitamente)                                                                    | Gris neutro con leve tono frío — idóneo para backoffice profesional + dark mode. Alternativas descartadas: slate (más frío), gray (más plano)                                                                                                                                                                                      | —                   |
| D-013 | Vercel Analytics + SpeedInsights  | Plan §T.10 (Fase 0.16)                          | **`@vercel/analytics@1.6.1` + `@vercel/speed-insights@1.3.1`** en `layout.tsx`                       | Paquetes oficiales instalados. `<Analytics />` y `<SpeedInsights />` inyectados en root layout. Activos en producción al conectar repo a Vercel                                                                                                                                                                                    | —                   |
| D-014 | `next.config.ts` — output mode    | No especificado                                 | **`output: 'standalone'` eliminado**                                                                 | `standalone` es para self-hosted (Docker, servidores propios). En Vercel, el file tracer (`nft`) espera `page_client-reference-manifest.js` para cada `page.js`. Las páginas Server-only sin Client Component imports no generan ese manifest → ENOENT fatal en deploy. Vercel tiene su propio pipeline; no requiere `standalone`. | —                   |
| D-015 | Route groups — páginas duplicadas | Una `page.tsx` por ruta                         | **Prohibido: `app/page.tsx` + `app/(group)/page.tsx` para la misma URL**                             | Next.js compila ambas. El file tracer de Vercel encuentra el `page.js` del route group y busca su manifest. Si la página no tiene Client Components, el manifest no existe → ENOENT. Fix: una sola página por ruta. Si está en el route group, debe importar al menos un Client Component o usar `redirect()`.                     | —                   |

### Pendientes de resolución

| #         | Item                                | Urgencia          | Notas                                                                                                                                                                     |
| --------- | ----------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-001     | Migrar `next lint` → `eslint` CLI   | Media (Next 16)   | Cuando se actualice Next.js a v16. Actualizar scripts, lint-staged, CI                                                                                                    |
| P-002     | Actualizar Tailwind v3 → v4         | Baja              | Cuando Shadcn/ui tenga soporte oficial estable de v4                                                                                                                      |
| P-003     | Migrar Prisma 6 → 7                 | Baja (post-MVP)   | Crear `prisma.config.ts`, seguir guía de upgrade oficial                                                                                                                  |
| P-004     | Minimatch CVE en @typescript-eslint | Baja (transitiva) | Actualizar `@typescript-eslint/*` cuando lancen versión con minimatch ≥10.2.1                                                                                             |
| P-005     | Sentry setup (Fase 0.18)            | Media             | Requiere cuenta sentry.io + DSN. Ejecutar `pnpm dlx @sentry/wizard@latest -i nextjs`. Verificar que `next.config.ts` conserve los security headers post-wizard            |
| ~~P-006~~ | ~~Vercel project connection~~       | ~~Media~~         | ✅ **Resuelto 2026-02-24** — Repo conectado, env vars configuradas, Build Command = sin override (`pnpm build`), Install Command = sin override (`CI=true` usa lockfile). |
