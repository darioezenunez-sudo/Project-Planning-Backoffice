# PERFORMANCE.md — Auditoría de Latencia & Plan de Optimización

> **Version:** 1.3.0 | **Updated:** 2026-03-02
> Contexto del proyecto → `CLAUDE.md` | Estándares de código → `docs/ENGINEERING_STANDARDS.md`

---

## 0. Estado de implementación

### ✅ Fase 1 — Completada (2026-03-01)

| ID    | Qué                                                                | Archivos                                                                     | Estado   |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------- |
| **C** | Eliminar `staleTime: 5_000` en `useEchelon` y `useEchelonSessions` | `src/hooks/use-echelons.ts`                                                  | ✅ Hecho |
| **A** | Caché de membresía en `withTenant` (TTL 120 s)                     | `src/lib/cache/tenant-cache.ts` (nuevo), `src/lib/middleware/with-tenant.ts` | ✅ Hecho |
| **B** | Caché de token Bearer en `withAuth` (TTL 60 s)                     | `src/lib/cache/auth-cache.ts` (nuevo), `src/lib/middleware/with-auth.ts`     | ✅ Hecho |

Invalidación cubierta:

- `PATCH /organizations/{id}/members/{userId}` → llama `invalidateTenantMemberCache`
- `DELETE /organizations/{id}/members/{userId}` → llama `invalidateTenantMemberCache`
- `POST /api/v1/auth/logout` (pendiente de implementar) → deberá llamar `invalidateAuthCache(token)`

Tests unitarios entregados: `tenant-cache.test.ts`, `auth-cache.test.ts`, `with-tenant.test.ts` (extendido), `with-auth.test.ts` (extendido).

### 🟡 Fase 2 — Índices de base de datos (migración creada — pendiente de aplicar)

Migración SQL creada el 2026-03-02: `prisma/migrations/20260302000001_add_partial_indexes_performance/migration.sql`

Para aplicar:

```bash
pnpm db:migrate
```

Ver §4 para el análisis completo y §6 para el detalle de cada índice.

### ⬜ Diferido — Caché de entidades a nivel de ruta (Opción D)

Se evalúa después de medir el impacto de la Fase 2 en producción. Ver §5.

### ❌ Descartado — Endpoint batch (Opción E)

Rompe la convención REST y el contrato del Electron App. Con la Fase 1 implementada, el beneficio es nulo.

---

## 1. Contexto del sistema

Este proyecto tiene **dos clientes** que consumen la API `/api/v1/`:

| Cliente                          | Canal de auth en `withAuth`                                               | Cubierto por Fase 1                                               |
| -------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Backoffice** (Next.js browser) | Cookies (`resolveFromCookies`) — **no cacheable** (token rota en refresh) | Parcialmente — `withTenant` cacheado (A), staleTime corregido (C) |
| **Electron App** (Data Plane)    | Bearer token (`resolveFromBearer`) — **cacheable**                        | Completamente — `withAuth` (B) + `withTenant` (A)                 |

---

## 2. Hallazgos de latencia — Primera auditoría (middleware)

### 2.1 `withTenant` — query DB en cada request ✅ RESUELTO

**Archivo:** `src/lib/middleware/with-tenant.ts` — línea 51 (antes de la implementación)

```ts
const member = await prisma.organizationMember.findFirst({
  where: { organizationId, userId: ctx.userId },
  select: { role: true },
});
```

Pagado en cada request de ambos clientes. Con 3 hooks paralelos en la página de detalle → 3 queries simultáneas a la misma fila. **Resuelto con `tenant-cache.ts` (Opción A).**

### 2.2 `withAuth` canal Bearer — round-trip Supabase por request ✅ RESUELTO para Electron App

**Archivo:** `src/lib/middleware/with-auth.ts` — línea 69 (antes de la implementación)

`supabase.auth.getUser(token)` es validación activa contra el servidor de Supabase, no verificación local del JWT. **Resuelto para el canal Bearer con `auth-cache.ts` (Opción B). El canal de cookies no se cachea** — el token rota en cada refresh de sesión que ejecuta `middleware.ts`.

### 2.3 `staleTime: 5_000` en dos hooks ✅ RESUELTO

**Archivo:** `src/hooks/use-echelons.ts`

`useEchelon` y `useEchelonSessions` sobreescribían el global de `30_000` con `5_000`. Eliminado — ambos heredan el global del `QueryProvider`. **Resuelto con Opción C.**

### 2.4 `withAuth` canal Cookies — round-trip Supabase por request ⚠️ PENDIENTE

El canal de cookies del Backoffice browser sigue haciendo `supabase.auth.getUser()` en cada request. Este es ahora el mayor costo residual para el browser: ~200–400 ms de latencia de red a gru1 por request, sin solución de caché posible sin cambiar el mecanismo de auth.

**Impacto en producción (Vercel gru1 → Supabase gru1):** el salto es local al datacenter → ~2–5 ms. No es un problema real en producción. Solo impacta el entorno de desarrollo (máquina local → gru1).

---

## 3. Análisis de latencia — Segunda auditoría (2026-03-01)

### 3.1 Piso de latencia geográfico en desarrollo

Con casi 0 registros en la DB, cada query tarda < 1 ms en ejecutarse. La latencia observada (600–1200 ms en primer load) proviene de saltos de red a gru1 (São Paulo):

```
Máquina de desarrollo
  → withAuth (cookies) → Supabase Auth gru1          ~200–400 ms  (no cacheable hoy)
  → withTenant (cache hit) → Upstash Redis gru1       ~50–100 ms  (cacheado, Fase 1)
  → Prisma query → PgBouncer → Supabase DB gru1       ~50–150 ms
  ──────────────────────────────────────────────────────────────
  Piso total dev → gru1                               ~300–650 ms
```

**En producción (Vercel Functions región gru1):** los tres saltos son comunicación local dentro del mismo datacenter → **< 10 ms total**. Las queries con casi 0 datos llegarán a los 1–3 ms que se esperan.

### 3.2 Evidencia de los logs (segunda sesión)

**Primera pasada (cache frío):**

| Endpoint             | Tiempo              | Tipo                        |
| -------------------- | ------------------- | --------------------------- |
| `login`              | 1.10 s              | Supabase auth — esperado    |
| `me`                 | 622 ms → 943 ms     | Cookie auth sin caché       |
| `echelons?limit=100` | 740 ms → 829 ms     | No mejora entre pasadas     |
| `devices`            | 1.19 s → 882 ms     | Mejora leve                 |
| `companies?limit=20` | 1.19 s → 618 ms     | Mejora leve                 |
| `audit?limit=50`     | 1.06 s              | Sin cache hit evidente      |
| `companies?_rsc`     | 3.04 s → **483 ms** | RSC cacheado por Next.js ✅ |
| `echelons?_rsc`      | 1.75 s → **431 ms** | RSC cacheado por Next.js ✅ |

**Patrón confirmado:** las páginas RSC (`?_rsc=`) mejoran ~6× en la segunda pasada (Next.js las cachea). Los endpoints API puros no mejoran entre pasadas porque `withAuth` cookie sigue siendo un round-trip fresco a gru1 en cada request.

---

## 4. Análisis de índices — Auditoría del schema (2026-03-01)

### 4.1 Inventario completo de índices vs. queries reales

#### `OrganizationMember` — `withTenant`

Query: `WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL`

| Índice en schema                     | Columnas            | Sirve para esta query                            |
| ------------------------------------ | ------------------- | ------------------------------------------------ |
| `@@unique([organizationId, userId])` | `(org_id, user_id)` | ✅ Lookup O(log n), cerca de O(1) para par único |
| `@@index([organizationId])`          | `(org_id)`          | Redundante para esta query                       |
| `@@index([userId])`                  | `(user_id)`         | Redundante para esta query                       |

El `deleted_at IS NULL` se chequea post-índice sobre la fila encontrada. Con 1 fila por par (org, user), el costo es despreciable. **Sin problemas.**

---

#### `AuditLog` — `GET /audit`

Query: `WHERE organization_id = $1 ORDER BY created_at DESC`

| Índice en schema                             | Columnas                               | Sirve para esta query                         |
| -------------------------------------------- | -------------------------------------- | --------------------------------------------- |
| `@@index([organizationId, createdAt])`       | `(org_id, created_at)`                 | ✅ Index range scan + backward scan para DESC |
| `@@index([entityType, entityId, createdAt])` | `(entity_type, entity_id, created_at)` | Para queries filtradas por entidad            |
| `@@index([actorId])`                         | `(actor_id)`                           | Para queries por actor                        |

**El único modelo con diseño de índice correcto para su query principal.** `AuditLog` es el modelo de referencia para el diseño de los demás.

---

#### `Company` — `GET /companies`

Query: `WHERE organization_id = $1 AND deleted_at IS NULL [AND id > cursor] ORDER BY id ASC`

| Índice en schema            | Columnas   | Sirve para esta query                                                                |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `@@index([organizationId])` | `(org_id)` | ✅ Filtra por org — luego `deleted_at` e `id > cursor` se aplican sobre el resultado |

**Problema:** el cursor usa `id > cursor`. Para esta combinación `WHERE org_id = $1 AND id > cursor ORDER BY id ASC`, el índice óptimo es `(organization_id, id)`. Hoy PostgreSQL usa el índice de `org_id`, filtra `deleted_at` y `id > cursor` en memoria, y ordena por `id` (que coincide con la PK, eficiente). Con < 5 filas no se nota. **Problema latente a escala.**

---

#### `Echelon` — `GET /echelons`

Query: `WHERE organization_id = $1 [AND state = $2] [AND id > cursor] AND deleted_at IS NULL ORDER BY id ASC`

| Índice en schema                   | Columnas          | Sirve para esta query                                                                           |
| ---------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `@@index([organizationId, state])` | `(org_id, state)` | ✅ Cuando se filtra por `state` — usa ambas columnas. Sin `state`, solo usa el prefijo `org_id` |
| `@@index([productId])`             | `(product_id)`    | Para queries filtradas por producto                                                             |

**Problema:** No existe un `@@index([organizationId])` standalone. La query más frecuente (listar todos los echelons sin filtro de estado) usa `(organizationId, state)` como prefix scan — PostgreSQL solo aprovecha la primera columna del índice compuesto. Además, sin filtro de `state`, el planner puede optar por un seq scan si la selectividad de `org_id` es baja. **Problema latente.**

---

#### `Device` — `GET /devices`

Query: `WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`

| Índice en schema                        | Columnas                | Sirve para esta query                      |
| --------------------------------------- | ----------------------- | ------------------------------------------ |
| `@@index([organizationId])`             | `(org_id)`              | ✅ Filtra por org                          |
| `@@index([machineId, userId])`          | `(machine_id, user_id)` | Para lookup por machineId del Electron App |
| `@@unique([organizationId, machineId])` | `(org_id, machine_id)`  | Para enrollment único                      |

**Problema:** `ORDER BY created_at DESC` sin índice que incluya `created_at`. PostgreSQL lee todas las filas de la org (desde el índice de `org_id`), filtra `deleted_at`, y **ordena en memoria por `created_at`**. Con 0–5 dispositivos es invisible. Con cientos de dispositivos es un sort en memoria sobre el full set de la org.

El modelo de referencia correcto es `AuditLog` con `@@index([organizationId, createdAt])`.

---

#### `Session`, `RequiredField`, `ExecutiveSummary` — queries por `echelonId`

| Modelo             | Índice actual                                                                      | Query real                                                          |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Session`          | `@@index([echelonId])`, `@@index([organizationId])`                                | `WHERE echelon_id = $1 AND org_id = $2 ORDER BY session_number ASC` |
| `RequiredField`    | `@@index([echelonId])`, `@@index([organizationId])`                                | `WHERE echelon_id = $1 AND org_id = $2`                             |
| `ExecutiveSummary` | `@@index([sessionId, state])`, `@@index([echelonId])`, `@@index([organizationId])` | `WHERE echelon_id = $1 AND org_id = $2 [AND state = VALIDATED]`     |

Estos modelos tienen índices separados para `echelonId` y `organizationId` pero **no índices compuestos `(echelonId, organizationId)`**. La query siempre filtra por ambos. PostgreSQL elige uno y aplica el otro como post-filter. Con pocas filas por echelon, es correcto. A escala, el compuesto `(echelon_id, organization_id)` sería mejor.

---

### 4.2 El problema transversal: `deleted_at` nunca está en los índices

La extensión soft-delete de Prisma agrega automáticamente `AND deleted_at IS NULL` a cada `findMany`, `findFirst`, `count`, `aggregate`. Sin embargo, **ningún índice del schema incluye `deleted_at`** — PostgreSQL siempre lo aplica como filtro post-índice.

La solución técnica correcta son **partial indexes** en PostgreSQL:

```sql
-- Ejemplo: solo indexar registros activos (deleted_at IS NULL)
-- Más pequeño, más rápido, exactamente lo que las queries necesitan
CREATE INDEX companies_org_active ON companies (organization_id, id)
WHERE deleted_at IS NULL;
```

Prisma no soporta cláusulas `WHERE` en `@@index`. La implementación requiere una migración SQL raw en `prisma/migrations/`.

---

## 5. Diferido — Opción D: Caché de entidades a nivel de ruta

**Qué sería:** cachear las respuestas completas de `GET /echelons/{id}` y `GET /echelons/{id}/sessions` en Redis (siguiendo el patrón de `context-cache.ts`). TTL: 60 s. Invalidar en cada mutación.

**Por qué se difiere:** la mayor parte de la latencia residual en el browser es el `withAuth` de cookies (round-trip a Supabase), que es irreducible hoy. La query del dominio contribuye < 100 ms. El beneficio marginal de cachear las entidades no justifica el riesgo de instrumentar incorrectamente la invalidación (datos stale si falta un punto de invalidación).

**Criterio de revisión:** si después de desplegar a producción y medir con Vercel Analytics el p95 de los endpoints de echelon supera 300 ms, esta opción se implementa.

---

## 6. Plan de Fase 2 — Migración de índices

### 6.1 Qué se implementa y por qué

Los siguientes índices se agregan como migración SQL raw en Prisma. El criterio de inclusión es: la query real usa esas columnas combinadas y el índice actual no las cubre eficientemente.

**`companies`** — cursor pagination + soft-delete:

```sql
-- Reemplaza el uso de @@index([organizationId]) para queries con cursor
CREATE INDEX companies_org_id_active_idx ON companies (organization_id, id)
WHERE deleted_at IS NULL;
```

Cubre: `WHERE organization_id = $1 AND deleted_at IS NULL [AND id > cursor] ORDER BY id ASC`

---

**`echelons`** — listado sin filtro de estado + cursor pagination:

```sql
-- Cubre el caso más frecuente: listar todos los echelons de una org
CREATE INDEX echelons_org_id_active_idx ON echelons (organization_id, id)
WHERE deleted_at IS NULL;

-- El @@index([organizationId, state]) existente ya cubre el caso con filtro de estado
```

Cubre: `WHERE organization_id = $1 AND deleted_at IS NULL [AND id > cursor] ORDER BY id ASC`

---

**`devices`** — sort por `created_at`:

```sql
-- Cubre el ORDER BY created_at DESC sin sort en memoria
CREATE INDEX devices_org_created_active_idx ON devices (organization_id, created_at DESC)
WHERE deleted_at IS NULL;
```

Cubre: `WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`

---

**`sessions`** — query por echelon + sort por número de sesión:

```sql
CREATE INDEX sessions_echelon_org_active_idx ON sessions (echelon_id, organization_id, session_number ASC)
WHERE deleted_at IS NULL;
```

Cubre: `WHERE echelon_id = $1 AND organization_id = $2 AND deleted_at IS NULL ORDER BY session_number ASC`

---

**`required_fields`** — query por echelon:

```sql
CREATE INDEX required_fields_echelon_org_active_idx ON required_fields (echelon_id, organization_id)
WHERE deleted_at IS NULL;
```

Cubre: `WHERE echelon_id = $1 AND organization_id = $2 AND deleted_at IS NULL`

---

**`executive_summaries`** — query por echelon con filtro de estado:

```sql
-- Para context-bundle: VALIDATED summaries por echelon
CREATE INDEX exec_summaries_echelon_state_active_idx ON executive_summaries (echelon_id, organization_id, state)
WHERE deleted_at IS NULL;
```

Cubre: `WHERE echelon_id = $1 AND organization_id = $2 AND state = 'VALIDATED' AND deleted_at IS NULL`

---

### 6.2 Qué no se cambia

| Modelo               | Índice actual                  | Por qué se conserva                              |
| -------------------- | ------------------------------ | ------------------------------------------------ |
| `OrganizationMember` | `@@unique([orgId, userId])`    | Correcto — O(1) lookup por par único             |
| `AuditLog`           | `@@index([orgId, createdAt])`  | Correcto — modelo de referencia del proyecto     |
| `Echelon`            | `@@index([orgId, state])`      | Se conserva — cubre el caso con filtro de estado |
| `Device`             | `@@unique([orgId, machineId])` | Se conserva — enrollment único por machine       |

---

### 6.3 Estado de la migración

Los índices parciales (`WHERE deleted_at IS NULL`) no son generables por `prisma migrate dev` desde el schema — Prisma DSL no soporta cláusulas `WHERE` en `@@index`. Se crearon manualmente como migración SQL raw.

**El archivo ya existe:** `prisma/migrations/20260302000001_add_partial_indexes_performance/migration.sql`

Para aplicar al entorno local o a producción:

```bash
# Aplica todas las migraciones pendientes (incluyendo ésta)
pnpm db:migrate

# En CI/producción (no interactivo):
pnpm db:migrate:deploy
```

El schema `prisma/schema.prisma` **no se modifica** — los partial indexes no tienen representación en Prisma DSL. La fuente de verdad de estos índices es el archivo de migración SQL.

---

## 7. Esquema completo de claves del caché

```
Existentes (Fase 3):
  ctx:{echelonId}                     TTL 300 s   context bundle

Agregadas en Fase 1:
  tenant:{userId}:{organizationId}    TTL 120 s   rol de membresía (Opción A)
  auth:{sha256(token)[0:24]}          TTL  60 s   token Bearer → userId (Opción B)

Diferidas (Opción D):
  echelon:{echelonId}                 TTL  60 s   datos del echelon
  echelon-sessions:{echelonId}        TTL  60 s   lista de sessions del echelon
```

---

## 8. Matriz de invalidación

| Clave de caché            | Evento que invalida     | Dónde llamar `kvDel`                                          |
| ------------------------- | ----------------------- | ------------------------------------------------------------- |
| `tenant:{userId}:{orgId}` | Cambio de rol           | PATCH `/organizations/{id}/members/{userId}` ✅ implementado  |
| `tenant:{userId}:{orgId}` | Eliminación de miembro  | DELETE `/organizations/{id}/members/{userId}` ✅ implementado |
| `auth:{tokenHash}`        | Logout del Electron App | POST `/auth/logout` ⬜ pendiente (endpoint no existe aún)     |
| `ctx:{echelonId}`         | Summary → VALIDATED     | `invalidateContextCacheIfValidated()` ✅ ya existía           |

---

## 9. Impacto esperado por entorno

| Escenario                                    | Antes Fase 1  | Después Fase 1  | Después Fase 2 (producción)                |
| -------------------------------------------- | ------------- | --------------- | ------------------------------------------ |
| Primer load (browser, dev)                   | ~2.5 s        | ~600–900 ms     | N/A — irreducible en dev por latencia gru1 |
| Primer load (browser, producción)            | ~300–500 ms   | ~150–300 ms     | **~20–50 ms**                              |
| Navegación intra-app (cache caliente)        | ~2.5 s        | ~100–200 ms     | **~10–30 ms**                              |
| Queries `organization_members` por page load | 3 (paralelas) | 0–1 (cache hit) | 0–1                                        |
| Round-trips Supabase auth (Bearer)           | 1 por request | 0–1 (cache hit) | 0–1                                        |
| DB query execution (casi 0 datos)            | < 1 ms        | < 1 ms          | < 1 ms ← siempre fue así                   |

---

## 10. Notas sobre entorno de desarrollo

Los Fast Refresh rebuilds (100 ms–2.5 s en los logs), el overhead de Sentry con source maps (`Client Instrumentation Hook: 475ms`), y Vercel Analytics en debug mode son exclusivos del entorno de desarrollo. No existen en producción.

La latencia de `withAuth` cookies (~200–400 ms por request en dev) es el único cuello de botella estructural que persiste post Fase 1, y es consecuencia directa de la distancia geográfica entre la máquina de desarrollo y gru1. En producción (Vercel Functions gru1 → Supabase gru1) ese salto es local y toma < 5 ms.

---

## 11. Load testing (k6)

Pruebas de carga para endpoints críticos (Fase H — BACKLOG H3).

**Herramienta:** [k6](https://k6.io/docs/getting-started/installation/) (instalación local).

**Script:** `scripts/load-test.js`

**Endpoints ejercitados:**

- `GET /api/v1/companies` — lista paginada
- `GET /api/v1/context/:echelonId` — context bundle (el más pesado)
- `POST /api/v1/echelons/:id/consolidate` — consolidación AI

**Uso:**

```bash
# Obtener JWT y IDs (ej. login vía POST /api/v1/auth/login)
export AUTH_TOKEN="<jwt>"
export ORG_ID="<organization-uuid>"
export ECHELON_ID="<echelon-uuid>"   # opcional; si no se setea, context/consolidate se omiten

# Ejecutar (default: 5 VUs, 30s)
pnpm load-test

# O con k6 directo y variables
VUS=10 DURATION=60s BASE_URL=https://your-app.vercel.app AUTH_TOKEN=... ORG_ID=... ECHELON_ID=... k6 run scripts/load-test.js
```

**Umbrales por defecto:** `p(95) < 5s` para latencia, `http_req_failed < 10%`.
