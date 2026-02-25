# Plan de Resolución de Deuda Técnica — Project-Planning Backoffice

**Versión:** 1.1 · **Fecha:** 2026-02-25 · **Estado:** Activo — Sección A completa
**Complementa:** `ROADMAP.md` (estado de fases), `ENGINEERING_STANDARDS.md` (reglas de código), `DEVELOPMENT_PLAN_MVP.md` (fases y arquitectura)
**Propósito:** Inventario exhaustivo de deuda técnica acumulada en Fases 0–4, con checklists ejecutables paso a paso, estimaciones de esfuerzo y orden de resolución basado en dependencias.

---

## Estado Actual (2026-02-25)

### Sección A — Resolvibles en Código: ✅ COMPLETA

| ID  | Item                                  | Estado      | Archivos clave                                                                               |
| --- | ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| A1  | crypto.ts AES-256-GCM                 | ✅ Resuelto | `src/lib/utils/crypto.ts`, `tests/unit/lib/crypto.test.ts`                                   |
| A2  | Attachment module completo            | ✅ Resuelto | `src/modules/attachment/`, `src/schemas/attachment.schema.ts`, `src/lib/supabase/storage.ts` |
| A3  | Email adapter (Resend)                | ✅ Resuelto | `src/modules/integration/email.adapter.ts`, `email.templates.ts`                             |
| A4  | PDF adapter (react-pdf)               | ✅ Resuelto | `src/modules/integration/pdf.adapter.ts`, `pdf.templates/consolidation-report.tsx`           |
| A5  | withValidation params + Zod details   | ✅ Resuelto | `src/lib/middleware/with-validation.ts`                                                      |
| A6  | scripts/ DB operacionales (7 scripts) | ✅ Resuelto | `scripts/db-*.ts`                                                                            |
| A7  | Cache invalidation en VALIDATED       | ✅ Resuelto | `src/lib/cache/context-cache.ts`, route handler summary transition                           |

### Sección B — Bloqueados por Infraestructura: PENDIENTE

| ID  | Item                     | Estado       | Desbloqueante                                   |
| --- | ------------------------ | ------------ | ----------------------------------------------- |
| B1  | DB migrations (Supabase) | ⏳ Pendiente | Cuenta + credentials Supabase                   |
| B2  | RLS policies SQL         | ⏳ Pendiente | B1                                              |
| B3  | Seed data                | ⏳ Pendiente | B1                                              |
| B4  | Sentry setup             | ⏳ Pendiente | Cuenta Sentry + DSN                             |
| B5  | Vercel KV implementación | ⏳ Pendiente | Vercel KV store                                 |
| B6  | withRateLimit (Upstash)  | ⏳ Pendiente | B5                                              |
| B7  | Job consumer/worker      | ⏳ Pendiente | A3+A4 ✅ listos; falta implementar route + cron |
| B8  | Edge Functions           | 🔵 Diferido  | post-MVP                                        |

---

## Resumen Ejecutivo

Las Fases 0–4 entregaron la totalidad del backend: 184 tests, domain model completo, APIs REST, job queue con retry/dead-letter, AI consolidation engine y strategy pattern de integración. Para mantener velocidad de desarrollo, se dejaron stubs intencionales en: cifrado (AES-256-GCM), adaptadores de email y PDF, caching (Vercel KV), rate limiting (Upstash), módulo de attachments y scripts de mantenimiento de DB. Paralelamente, la infraestructura externa (Supabase live, Sentry, Vercel KV) nunca se configuró.

La **Sección A fue completada íntegramente**: crypto, attachment module, email adapter, PDF adapter, withValidation, scripts DB y cache invalidation. Lo que resta es exclusivamente infraestructura externa (Sección B).

**Hallazgo crítico:** El archivo `supabase/migrations/20260222000001_rls_policies.sql` referenciado en ROADMAP y MEMORY.md **no existe** — `supabase/migrations/` solo contiene `.gitkeep`. Las RLS policies deben escribirse desde cero (ver B2).

---

## Clasificación

| Sección                                | Descripción                                                                                                                                                                                                                                             | Criterio                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **A — Resolvibles en Código**          | Items que se implementan, testean y mergean usando solo el entorno de desarrollo actual. Sin cuentas externas, sin credentials, sin servicios terceros.                                                                                                 | Se pueden ejecutar en cualquier sesión de desarrollo |
| **B — Bloqueados por Infraestructura** | Items que requieren setup externo (Supabase project, Vercel KV store, cuenta Sentry, cuenta Resend) antes de poder verificarse contra servicios reales. El código se puede escribir con mocks, pero la resolución completa necesita el recurso externo. | Requieren acción manual en dashboards externos       |
| **C — Diferidos Intencionalmente**     | Items que **no son deuda**. Son stubs documentados como decisión de diseño para post-MVP.                                                                                                                                                               | No se resuelven en este plan                         |

---

## Sección A — Resolvibles en Código

### A1. `crypto.ts` — Implementación AES-256-GCM

**Descripción:** `encrypt()` y `decrypt()` en `src/lib/utils/crypto.ts` retornan strings vacíos. Se necesita cifrado real para API keys de dispositivos y credenciales de integración.

**Archivos afectados:**

- `src/lib/utils/crypto.ts` — reescritura completa
- `src/lib/env.ts` — confirmar que `ENCRYPTION_KEY` se consume en runtime
- `tests/unit/lib/crypto.test.ts` — archivo nuevo

**Checklist:**

1. Leer `ENCRYPTION_KEY` desde `env` (ya definido en `src/lib/env.ts`)
2. Implementar `encrypt(plaintext: string): string`:
   - Generar IV random de 12 bytes (`crypto.randomBytes(12)`)
   - Crear cipher con `crypto.createCipheriv('aes-256-gcm', key, iv)`
   - Cifrar + obtener auth tag (16 bytes)
   - Retornar formato: `base64(iv):base64(authTag):base64(ciphertext)`
3. Implementar `decrypt(cipherString: string): string`:
   - Parsear formato `iv:authTag:ciphertext`
   - Crear decipher con `crypto.createDecipheriv('aes-256-gcm', key, iv)`
   - Setear auth tag, descifrar, retornar plaintext
4. Validar longitud de `ENCRYPTION_KEY` (exactamente 32 bytes o derivar via HKDF)
5. Tests: roundtrip, key incorrecta falla, ciphertext alterado falla, input vacío
6. `pnpm validate`

**Estimación:** 2h
**Criterio de aceptación:** `decrypt(encrypt(x)) === x` para strings arbitrarios; datos alterados lanzan error; tests pasan.
**Dependencias:** Ninguna.

---

### A2. Módulo Attachment — CRUD + Supabase Storage (código mockeable)

**Descripción:** El modelo Prisma `Attachment` existe en `prisma/schema.prisma` (storageKey, mimeType, fileSize, relaciones a ExecutiveSummary y Echelon). No existen repository, service ni rutas. El directorio `src/modules/attachment/` no existe.

**Archivos a crear:**

- `src/schemas/attachment.schema.ts` — Zod schemas (createAttachment, attachmentResponse, listQuery)
- `src/modules/attachment/attachment.repository.ts` — factory pattern
- `src/modules/attachment/attachment.service.ts` — factory con deps `{repo, storageClient}`
- `src/lib/supabase/storage.ts` — adapter con `uploadFile`, `getSignedUrl`, `deleteFile` (stub para dev)
- `src/app/api/v1/attachments/route.ts` — POST upload, GET list
- `src/app/api/v1/attachments/[id]/route.ts` — GET signed URL, DELETE soft-delete
- `tests/unit/modules/attachment.service.test.ts`

**Checklist:**

1. Crear `src/schemas/attachment.schema.ts`:
   - `createAttachmentSchema`: filename, mimeType, fileSize, executiveSummaryId?, echelonId?
   - `attachmentResponseSchema`: full entity + signedUrl
   - `attachmentListQuerySchema`: extends paginationSchema con echelonId?, summaryId?
2. Crear `src/modules/attachment/attachment.repository.ts`:
   - `findById`, `findByEchelon`, `findBySummary`, `create`, `softDelete`
   - Patrón: factory de funciones con `prisma` como dep
3. Crear `src/lib/supabase/storage.ts`:
   - `uploadFile(bucket, path, buffer, contentType): Promise<Result<string>>`
   - `getSignedUrl(bucket, path, expiresIn): Promise<Result<string>>`
   - `deleteFile(bucket, path): Promise<Result<void>>`
   - Stub: retorna mock URLs en dev (sin Supabase Storage configurado)
4. Crear `src/modules/attachment/attachment.service.ts`:
   - `upload(file, metadata, orgId)`: genera storageKey, sube a storage, persiste metadata
   - `getDownloadUrl(id, orgId)`: busca attachment, genera signed URL
   - `list(query, orgId)`: cursor pagination por echelon o summary
   - `remove(id, orgId, version)`: soft delete con optimistic locking
5. Crear rutas API con `compose(withAuth, withTenant, withValidation)`
6. Tests unitarios mockeando repository y storage adapter
7. `pnpm validate`

**Estimación:** 6–8h
**Criterio de aceptación:** Service tests pasan con repo y storage mockeados; routes responden correctamente; validación Zod enforced.
**Dependencias:** Storage real necesita Supabase (B1), pero el código es testeable con mocks.

---

### A3. Email Adapter — Integración Resend

**Descripción:** `src/modules/integration/email.adapter.ts` es `export const emailAdapter = {};`. Se necesita integración con Resend SDK y templates tipados.

**Archivos afectados:**

- `src/modules/integration/email.adapter.ts` — reescritura completa
- `src/modules/integration/email.templates.ts` — archivo nuevo (4–5 templates)
- `tests/unit/modules/email.adapter.test.ts` — archivo nuevo
- `package.json` — agregar dependencia `resend`

**Checklist:**

1. `pnpm add resend`
2. Implementar `createEmailAdapter(apiKey: string)`:
   ```typescript
   // Retorna { send(template, to, data): Promise<Result<{id: string}, AppError>> }
   ```
3. Definir tipos de template:
   - `CONSOLIDATION_READY` — echelon listo para revisión
   - `ECHELON_CLOSED` — echelon cerrado, reporte adjunto
   - `BUDGET_ALERT` — umbral de presupuesto cruzado (80%, 100%)
   - `DEVICE_ENROLLED` — nuevo dispositivo registrado
4. Cada template: función que retorna `{ subject: string, html: string }` desde datos estructurados
5. Error handling: wrap errores de Resend en `AppError` con `ErrorCode.EXTERNAL_SERVICE_ERROR`
6. Tests: mock clase `Resend`, verificar payload, testear error paths
7. `pnpm validate`

**Estimación:** 4–5h
**Criterio de aceptación:** Adapter acepta datos tipados, construye payload correcto; tests pasan con SDK mockeado.
**Dependencias:** Envío real necesita `RESEND_API_KEY`, pero código funciona con mock.

---

### A4. PDF Adapter — Integración @react-pdf/renderer

**Descripción:** `src/modules/integration/pdf.adapter.ts` es `export const pdfAdapter = {};`. Se necesita generación de PDF para reportes de consolidación.

**Archivos afectados:**

- `src/modules/integration/pdf.adapter.ts` — reescritura completa
- `src/modules/integration/pdf.templates/consolidation-report.tsx` — archivo nuevo
- `tests/unit/modules/pdf.adapter.test.ts` — archivo nuevo
- `package.json` — agregar dependencia `@react-pdf/renderer`

**Checklist:**

1. `pnpm add @react-pdf/renderer`
2. Implementar `createPdfAdapter()`:
   ```typescript
   // Retorna { generateConsolidationReport(data): Promise<Result<Buffer, AppError>> }
   ```
3. Crear template React PDF para reporte de consolidación:
   - Header: nombre del echelon, producto, empresa, fecha
   - Resumen ejecutivo consolidado
   - Lista de decisiones
   - Checklist de RequiredFields (met/unmet)
   - Sección de riesgos
4. Usar `renderToBuffer()` de `@react-pdf/renderer`
5. Tests: verificar que buffer es no-vacío para input válido, verificar manejo de errores
6. `pnpm validate`

**Estimación:** 4–5h
**Criterio de aceptación:** Dado datos de consolidación, produce buffer PDF válido; template incluye todas las secciones; tests pasan.
**Dependencias:** Ninguna.

---

### A5. `withValidation` — Params validation + Zod error details

**Descripción:** `src/lib/middleware/with-validation.ts` valida body y query, pero no URL params. Los mensajes de error son strings genéricos sin detalle de campos. Marcado `@stub Fase 1`.

**Archivos afectados:**

- `src/lib/middleware/with-validation.ts` — extender (~40 líneas)
- `tests/unit/lib/with-validation.test.ts` — archivo nuevo o extender existente

**Checklist:**

1. Agregar `params?: z.ZodType` al tipo `SchemaMap`
2. En el middleware: si `schemas.params` está presente, awaitar `context.params` y parsear con Zod
3. Reemplazar catch blocks: extraer `ZodError.issues` e incluir en el response:
   ```json
   {
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "...",
       "details": [{ "field": "name", "message": "Required", "code": "invalid_type" }]
     }
   }
   ```
4. Retornar 422 (no 400) para errores de validación
5. Mantener resultados parseados accesibles al handler
6. Tests: body válido pasa, body inválido retorna 422 con detalle por campo, query inválido retorna 422, params inválido retorna 422
7. `pnpm validate`

**Estimación:** 1–2h
**Criterio de aceptación:** Errores de Zod detallados en response; URL params validados; body/query existentes siguen funcionando; tests pasan.
**Dependencias:** Ninguna.

---

### A6. `scripts/` — Scripts operacionales de DB

**Descripción:** `ENGINEERING_STANDARDS.md` §4.3 define 7 scripts de mantenimiento de DB. Ninguno existe. El directorio `scripts/` no existe.

**Archivos a crear:**

- `scripts/db-health.ts` — conexión, table sizes, index usage, dead tuples, cache hit ratio
- `scripts/db-analyze.ts` — EXPLAIN ANALYZE de queries críticas
- `scripts/db-cleanup.ts` — hard delete de soft-deleted rows > 90 días
- `scripts/db-vacuum.ts` — VACUUM ANALYZE en tablas de alto churn
- `scripts/db-backup.ts` — pg_dump a archivo local
- `scripts/db-seed.ts` — wrapper de `prisma db seed`
- `scripts/db-reset.ts` — wrapper de `prisma migrate reset`

**Archivos a modificar:**

- `package.json` — agregar scripts: `db:health`, `db:analyze`, `db:cleanup`, `db:vacuum`, `db:backup`

**Checklist:**

1. Crear directorio `scripts/`
2. Implementar cada script según templates en `ENGINEERING_STANDARDS.md` §4.3:
   - Import prisma client + `$queryRawUnsafe` para SQL directo
   - Output en formato JSON a stdout
3. `db-cleanup.ts`: tablas con soft delete = `echelons`, `sessions`, `executive_summaries`, `companies`, `products`, `devices`, `attachments`, `required_fields`
4. Agregar scripts npm en `package.json`
5. Verificar que compilan (`pnpm exec tsx scripts/db-health.ts --help` o similar)
6. `pnpm validate`

**Estimación:** 3–4h
**Criterio de aceptación:** 7 scripts existen, compilan sin errores, SQL correcto. Ejecución real depende de B1.
**Dependencias:** Ejecución funcional depende de B1 (DB live), pero código se escribe y valida ahora.

---

### A7. Invalidación de cache en transición a VALIDATED

**Descripción:** `invalidateContextCache(echelonId)` se llama al crear un summary (`POST /sessions/[id]/summary`) y al actualizar un required field (`PATCH /required-fields/[id]`). **No** se llama cuando un summary transiciona a estado VALIDATED. El comentario en `context-cache.ts` dice explícitamente que esto debe hacerse. `summary.service.ts` `transition()` no tiene la llamada.

**Archivos afectados:**

- El route handler que invoque `summary.transition()` a VALIDATED — agregar `invalidateContextCache(echelonId)` post-transición exitosa. Consistente con el patrón existente (las rutas hacen la invalidación, no los services).

**Checklist:**

1. Identificar dónde se transiciona un summary a VALIDATED (route handler o Server Action)
2. Después de `summary.transition()` exitoso con resultado VALIDATED: llamar `invalidateContextCache(echelonId)`
3. Obtener `echelonId` desde la relación summary → session → echelon
4. Test: verificar que la invalidación se llama en transición a VALIDATED
5. `pnpm validate`

**Estimación:** 30min
**Criterio de aceptación:** Al transicionar un summary a VALIDATED, el context cache del echelon se invalida; verificado por test.
**Dependencias:** Ninguna.

---

## Sección B — Bloqueados por Infraestructura Externa

### B1. Migraciones de Base de Datos — requiere Supabase live

**Descripción:** 3 migraciones Prisma existen y están listas para deploy:

1. `20260221000000_init_health_check` — tabla HealthCheck
2. `20260224120000_add_pgvector_embedding` — extensión pgvector + columna embedding
3. `20260224140000_add_jobs_and_consolidated_report` — enums Job, tabla jobs, columnas consolidación

**Qué bloquea:** Seed, RLS, tests de integración, ejecución de scripts de DB, cualquier dato real.
**Pre-requisito externo:** Proyecto Supabase creado con PostgreSQL 15.

**Checklist:**

1. Crear proyecto en https://supabase.com/dashboard
2. Project Settings → Database → Connection Strings:
   - Copiar pooled connection string (port 6543) → `DATABASE_URL`
   - Copiar direct connection string (port 5432) → `DIRECT_URL`
3. Project Settings → API:
   - Copiar URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Copiar anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copiar service role key → `SUPABASE_SERVICE_ROLE_KEY`
4. Agregar todas las vars a `.env.local`
5. Ejecutar: `pnpm db:migrate:deploy`
6. Verificar en Supabase Dashboard → Table Editor: todas las tablas esperadas presentes
7. Database → Extensions → buscar "vector" → habilitar pgvector
8. Ejecutar: `pnpm db:seed`
9. Agregar las mismas env vars en Vercel Dashboard → Environment Variables
10. Verificar: `pnpm dev` y probar `GET /api/v1/health`

**Estimación:** 1–2h
**Criterio de aceptación:** 3 migraciones desplegadas; tablas visibles en dashboard; seed data presente; pgvector habilitado; health check responde OK.
**Dependencias:** Ninguna (este es el root del grafo B).

---

### B2. RLS Policies — requiere B1

**Descripción:** El archivo `supabase/migrations/20260222000001_rls_policies.sql` referenciado en documentación **no existe**. `supabase/migrations/` solo contiene `.gitkeep`. Las policies deben escribirse desde cero siguiendo el modelo de `DEVELOPMENT_PLAN_MVP.md` (aislamiento por `organization_id` del JWT claim).

**Qué bloquea:** Aislamiento multi-tenant a nivel de base de datos (defense in depth).
**Pre-requisito externo:** B1 completo (tablas deben existir).

**Checklist:**

1. Crear `supabase/migrations/20260222000001_rls_policies.sql`
2. Para cada tabla con columna `organization_id`:

   ```sql
   ALTER TABLE nombre_tabla ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "tenant_isolation_select" ON nombre_tabla
     FOR SELECT USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

   CREATE POLICY "tenant_isolation_insert" ON nombre_tabla
     FOR INSERT WITH CHECK (organization_id = (auth.jwt() ->> 'org_id')::uuid);

   CREATE POLICY "tenant_isolation_update" ON nombre_tabla
     FOR UPDATE USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

   CREATE POLICY "tenant_isolation_delete" ON nombre_tabla
     FOR DELETE USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);
   ```

3. Tablas con `organization_id`: `organizations`, `organization_members`, `companies`, `products`, `echelons`, `sessions`, `executive_summaries`, `attachments`, `required_fields`, `decision_links`, `devices`, `usage_records`, `audit_logs`
4. Excepciones:
   - `users` — sin `organization_id`, acceso via `auth.uid()`
   - `health_checks` — tabla pública, sin RLS
   - `idempotency_keys` — sin filtro de org (keyed por UUID único)
   - `jobs` — sin filtro de org (procesados por worker interno)
5. Policy para service role: `CREATE POLICY "service_role_bypass" ON nombre_tabla FOR ALL USING (auth.role() = 'service_role');`
6. Aplicar via Supabase Dashboard → SQL Editor (copiar y ejecutar el archivo)
7. Test: crear 2 usuarios en orgs distintas, verificar que user A no ve datos de org B
8. Commitear el archivo SQL al repo

**Estimación:** 2–3h
**Criterio de aceptación:** RLS habilitado en todas las tablas con scope de tenant; queries cross-tenant retornan resultados vacíos; service role bypassa RLS.
**Dependencias:** B1.

---

### B3. Seed Data — requiere B1

**Descripción:** `prisma/seed.ts` existe y está completo: 1 org (Acme Consulting), 5 usuarios con roles distintos, 2 companies, 3 products, echelons y required fields ejemplo.

**Qué bloquea:** Desarrollo local con datos realistas.
**Pre-requisito externo:** B1 completo.

**Checklist:**

1. Verificar que B1 está completo
2. Crear usuarios matching en Supabase Auth (Dashboard → Authentication → Users) con los mismos IDs que `prisma/seed.ts`
3. Ejecutar: `pnpm db:seed`
4. Verificar en Supabase Dashboard: datos presentes en todas las tablas seeded
5. Probar: `pnpm dev` → navegar a `/api/v1/companies` → datos de seed visibles

**Estimación:** 30min
**Criterio de aceptación:** Seed data visible en todas las tablas; aplicación puede consultar datos.
**Dependencias:** B1.

---

### B4. Sentry — requiere cuenta + DSN

**Descripción:** No hay paquetes de Sentry instalados, no hay configuración. Referenciado como P-005 en `ENGINEERING_STANDARDS.md` §14 y como Fase 0.18 en `DEVELOPMENT_PLAN_MVP.md`.

**Qué bloquea:** Error tracking y monitoreo en producción.
**Pre-requisito externo:** Cuenta sentry.io + DSN de proyecto Next.js.

**Checklist:**

1. Crear cuenta en https://sentry.io (free tier: 5K errors/mes, 10K transactions/mes)
2. Crear proyecto de tipo Next.js en Sentry Dashboard
3. Copiar DSN
4. Ejecutar: `pnpm dlx @sentry/wizard@latest -i nextjs`
5. **CRÍTICO:** Después del wizard, verificar `next.config.ts`:
   - Los security headers deben estar intactos (CSP, HSTS, X-Frame-Options, etc.)
   - Si el wizard wrapeó la config con `withSentryConfig()`, verificar que los headers se preservan
   - Verificar que `sentry.client.config.ts` y `sentry.server.config.ts` existen
6. Agregar `SENTRY_DSN` a `.env.local`
7. Agregar `SENTRY_DSN` a Vercel Dashboard → Environment Variables
8. Verificar: deploy preview, provocar un error, confirmar que aparece en Sentry Dashboard
9. `pnpm validate`

**Estimación:** 1–2h
**Criterio de aceptación:** Sentry captura errores en dev y producción; security headers inalterados; `pnpm validate` green.
**Dependencias:** Ninguna (independiente del resto).

---

### B5. Vercel KV — requiere Vercel KV store

**Descripción:** `src/lib/cache/kv.ts` tiene implementaciones stub: `kvGet` retorna `null`, `kvSet` y `kvDel` son noops. El context cache (`src/lib/cache/context-cache.ts`) depende de estas funciones y efectivamente no hace nada.

**Qué bloquea:** Caching real (context bundles, counters de rate limit, session tokens).
**Pre-requisito externo:** Vercel KV store configurado + env vars `KV_REST_API_URL` y `KV_REST_API_TOKEN`.

**Checklist:**

1. Vercel Dashboard → Storage → Create KV Database
2. Copiar `KV_REST_API_URL` y `KV_REST_API_TOKEN`
3. Agregar a `.env.local` y Vercel Environment Variables
4. `pnpm add @vercel/kv`
5. Reescribir `src/lib/cache/kv.ts`:
   ```typescript
   import { kv } from '@vercel/kv';
   export async function kvGet<T>(key: string): Promise<T | null> {
     return kv.get<T>(key);
   }
   export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
     if (ttlSeconds) {
       await kv.set(key, value, { ex: ttlSeconds });
     } else {
       await kv.set(key, value);
     }
   }
   export async function kvDel(key: string): Promise<void> {
     await kv.del(key);
   }
   ```
6. Agregar fallback graceful: si env vars de KV no están presentes, mantener comportamiento noop actual (para dev sin KV)
7. Tests mockeando `@vercel/kv`
8. `pnpm validate`

**Estimación:** 2–3h
**Criterio de aceptación:** `kvGet/kvSet/kvDel` operan contra Vercel KV en producción; fallback graceful en dev; context cache funciona; tests pasan.
**Dependencias:** Ninguna (independiente).

---

### B6. `withRateLimit` — requiere B5

**Descripción:** `src/lib/middleware/with-rate-limit.ts` es un passthrough stub. Necesita `@upstash/ratelimit` con Vercel KV como backend.

**Qué bloquea:** Rate limiting a nivel de aplicación en todos los endpoints.
**Pre-requisito externo:** B5 completo (KV store operacional).

**Checklist:**

1. `pnpm add @upstash/ratelimit`
2. Reescribir `src/lib/middleware/with-rate-limit.ts`:
   - Crear ratelimiter por config (algorithm, limit, window, key extractor)
   - Key extraction: `userId` del auth context, o `IP` de headers, o `machineId` del device context
3. On limit exceeded → 429 con headers:
   ```
   Retry-After: <seconds>
   X-RateLimit-Limit: <limit>
   X-RateLimit-Remaining: <remaining>
   X-RateLimit-Reset: <unix_timestamp>
   ```
4. Configurar limits por endpoint según `DEVELOPMENT_PLAN_MVP.md` T.3:
   | Categoría | Algoritmo | Límite | Ventana | Key |
   |-----------|-----------|--------|---------|-----|
   | Auth (login, register) | Fixed Window | 5 req | 15 min | IP |
   | Device enrollment | Fixed Window | 3 req | 1 hora | userId |
   | Read endpoints (GET) | Sliding Window | 100 req | 1 min | userId |
   | Write endpoints (POST/PUT/PATCH) | Sliding Window | 30 req | 1 min | userId |
   | Assistant endpoints | Token Bucket | 10 burst, 2 req/s | — | machineId |
   | Context bundle | Fixed Window | 10 req | 5 min | machineId |
5. Tests mockeando la librería de ratelimit
6. Aplicar a rutas existentes (ya tienen `withRateLimit` en la composición, solo era noop)
7. `pnpm validate`

**Estimación:** 2–3h
**Criterio de aceptación:** Rate limits enforced con headers correctos; 429 retornado al exceder; config por endpoint correcta; tests pasan.
**Dependencias:** B5.

---

### B7. Job Consumer/Worker — requiere infraestructura de ejecución

**Descripción:** La infraestructura de job queue existe completa (repository con `listReadyToRun`, service con retry/dead-letter, 184 tests). Pero no existe proceso que CONSUMA jobs pendientes. Los jobs se encolan (tipos: PDF, EMAIL, BUDGET_ALERT) pero nunca se ejecutan.

**Qué bloquea:** Generación de PDF, envío de emails, alertas de presupuesto — todas las operaciones asíncronas.
**Pre-requisito externo:** Decisión sobre ambiente de ejecución.

**Enfoque recomendado: API route + Vercel Cron (opción más simple para solo dev).**

**Checklist:**

1. Crear `src/app/api/v1/jobs/process/route.ts`:
   - POST handler protegido por header `Authorization: Bearer <CRON_SECRET>`
   - Llama `jobService.listReadyToRun(10)` (batch de 10)
   - Para cada job: `markRunning` → ejecutar según tipo → `markCompleted` o `markFailed`
2. Dispatch por tipo de job:
   ```typescript
   switch (job.type) {
     case 'PDF':
       await pdfAdapter.generateConsolidationReport(job.payload);
       break;
     case 'EMAIL':
       await emailAdapter.send(job.payload.template, job.payload.to, job.payload.data);
       break;
     case 'BUDGET_ALERT':
       await emailAdapter.send('BUDGET_ALERT', job.payload.to, job.payload.data);
       break;
   }
   ```
3. Agregar `CRON_SECRET` a env vars
4. Actualizar `vercel.json`:
   ```json
   {
     "crons": [{ "path": "/api/v1/jobs/process", "schedule": "* * * * *" }]
   }
   ```
5. Proteger endpoint: validar header `Authorization` contra `CRON_SECRET`
6. Tests del route handler con jobs mockeados
7. `pnpm validate`

**Estimación:** 4–6h
**Criterio de aceptación:** Jobs pendientes se consumen dentro de 1 minuto; jobs fallidos retryan con exponential backoff; dead letter después de 3 intentos; tests pasan.
**Dependencias:** A3 (email adapter) y A4 (PDF adapter) para ejecución real.

---

### B8. Edge Functions — Diferido a post-MVP

**Descripción:** `supabase/functions/` está vacío. Originalmente planificado como ambiente de ejecución para workers de PDF, email y consolidación.

**Decisión:** **Diferido.** B7 (Vercel Cron + API route) es más simple para solo dev y cubre los mismos casos de uso. Edge Functions se vuelven relevantes solo si la ejecución de jobs excede el timeout de 10s de Vercel (la consolidación podría, pero ya corre inline en POST /consolidate).

**Estimación si se implementa:** 6–8h
**Dependencias:** B1.

---

## Orden de Ejecución Recomendado

```
═══ Track 1: Código ─────────────────────────── ✅ COMPLETO ════

  [A7] ✅ Cache invalidation VALIDATED
  [A1] ✅ crypto.ts AES-256-GCM
  [A5] ✅ withValidation params+details
  [A6] ✅ scripts/ DB operacionales
  [A3] ✅ Email adapter (Resend)
  [A4] ✅ PDF adapter (react-pdf)
  [A2] ✅ Attachment module completo

═══ Track 2: Infraestructura — PENDIENTE ════════════════════════

  [B4] Sentry setup ────────────────── 1-2h ─── (independiente)
                                                │
  [B1] Supabase setup ──────────────── 1-2h ──┤
    ├── [B2] RLS policies ───────────── 2-3h ──┤
    └── [B3] Seed data ──────────────── 30min ─┤
                                                │
  [B5] Vercel KV ───────────────────── 2-3h ──┤
    └── [B6] withRateLimit ──────────── 2-3h ──┤
                                                │
═══ Track 3: Worker ─────────────────────────────────────────────
                                                │
  [B7] Job consumer/worker ──────────── 4-6h ──┘
       (A3 ✅ + A4 ✅ listos; solo falta route + cron)

═══ Diferido ════════════════════════════════════════════════════
  [B8] Edge Functions ─── post-MVP
```

**Orden recomendado para lo que queda (solo Sección B):**

| Paso | Item                                    | Estimación | Justificación                                          |
| ---- | --------------------------------------- | ---------- | ------------------------------------------------------ |
| 1    | B4 — Sentry                             | 1–2h       | Independiente; desbloquea observabilidad en producción |
| 2    | B1 — Supabase migrations                | 1–2h       | Root dependency de B2 y B3                             |
| 3    | B2 — RLS policies (escribir desde cero) | 2–3h       | Depende B1; seguridad multi-tenant                     |
| 4    | B3 — Seed data                          | 30min      | Depende B1; datos para desarrollo                      |
| 5    | B5 — Vercel KV                          | 2–3h       | Desbloquea cache real y rate limiting                  |
| 6    | B6 — withRateLimit                      | 2–3h       | Depende B5                                             |
| 7    | B7 — Job consumer/worker                | 4–6h       | A3+A4 listos; solo falta la route + cron config        |

---

## Resumen de Estimaciones

| ID  | Item                                   | Estimación  | Estado          | Dependencias    |
| --- | -------------------------------------- | ----------- | --------------- | --------------- |
| A7  | Cache invalidation VALIDATED           | 30min       | ✅ Resuelto     | —               |
| A1  | crypto.ts AES-256-GCM                  | 2h          | ✅ Resuelto     | —               |
| A5  | withValidation params + details        | 1–2h        | ✅ Resuelto     | —               |
| A6  | scripts/ DB operacionales              | 3–4h        | ✅ Resuelto     | —               |
| A3  | Email adapter (Resend)                 | 4–5h        | ✅ Resuelto     | —               |
| A4  | PDF adapter (react-pdf)                | 4–5h        | ✅ Resuelto     | —               |
| A2  | Attachment module completo             | 6–8h        | ✅ Resuelto     | —               |
| B4  | Sentry setup                           | 1–2h        | ⏳ Pendiente    | Cuenta Sentry   |
| B1  | Database migrations (Supabase)         | 1–2h        | ⏳ Pendiente    | Cuenta Supabase |
| B2  | RLS policies SQL (escribir desde cero) | 2–3h        | ⏳ Pendiente    | B1              |
| B3  | Seed data                              | 30min       | ⏳ Pendiente    | B1              |
| B5  | Vercel KV implementación               | 2–3h        | ⏳ Pendiente    | Vercel KV store |
| B6  | withRateLimit (Upstash)                | 2–3h        | ⏳ Pendiente    | B5              |
| B7  | Job consumer/worker                    | 4–6h        | ⏳ Pendiente    | A3 ✅ A4 ✅     |
| B8  | Edge Functions                         | Diferido    | 🔵 post-MVP     | B1              |
|     | **Sección A**                          | **~21–31h** | ✅ **Completa** |                 |
|     | **Sección B pendiente**                | **~13–20h** | ⏳ **En curso** |                 |

---

## Criterio de Cierre

La deuda técnica se considera resuelta cuando:

1. Todos los items de Sección A implementados, testeados y mergeados a `develop`
2. Todos los items de Sección B (excepto B8) implementados y verificados en staging
3. `pnpm validate` green (lint + types + todos los tests)
4. Count de tests incrementa en ~40–60 tests nuevos respecto a 184 actuales
5. No quedan comentarios `@stub`, `Stub — Fase`, `TODO — Fase` en archivos afectados
6. `ROADMAP.md` §3 actualizado para reflejar items resueltos
7. Cada item en este documento marcado como completado con fecha

---

## Sección C — Diferidos Intencionalmente (No son deuda)

Estos items son stubs **por diseño**, documentados como decisión de arquitectura para post-MVP. No se resuelven en este plan.

| Item                             | Archivos                                                      | Justificación                                                                                                                                  | Cuándo retomar                                                    |
| -------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PM Strategy                      | `src/modules/integration/strategies/pm.strategy.ts`           | Alias intencional a `defaultStrategy`. Integraciones PM (Jira, Trello) son post-MVP.                                                           | Cuando se contrate integración PM específica                      |
| Architecture Strategy            | `src/modules/integration/strategies/architecture.strategy.ts` | Mismo caso. Outputs específicos de arquitectura (Mermaid, C4) son post-MVP.                                                                    | Cuando se necesiten formatos de output específicos                |
| pgvector ranked retrieval        | `src/lib/pgvector.ts`                                         | Helper funcional y testeado. No integrado en context bundle porque el Assistant aún no envía queryEmbedding. Requiere acuerdo de contrato API. | Cuando el Assistant envíe vectores de embedding                   |
| Edge Functions                   | `supabase/functions/`                                         | Reemplazadas por Vercel Cron + API route (B7). Más complejidad de la necesaria para solo dev.                                                  | Si ejecución de jobs excede timeout de 10s                        |
| Database webhooks                | N/A                                                           | Planificados en Fase 4.8 pero no necesarios — la cola de jobs maneja el trigger.                                                               | Cuando consumidores externos necesiten reaccionar a eventos de DB |
| Consolidation como Edge Function | N/A                                                           | Actualmente corre inline en `POST /consolidate`. Funciona para límites de tokens del MVP.                                                      | Si la consolidación consistentemente excede 10s                   |
| Prisma 6 → 7                     | `prisma/schema.prisma`                                        | Prisma 7 tiene breaking change (`prisma.config.ts`). Documentado como P-003.                                                                   | Post-MVP, siguiendo guía oficial de upgrade                       |
| Tailwind v3 → v4                 | `tailwind.config.ts`                                          | v4 incompatible con Shadcn/ui. Documentado como P-002.                                                                                         | Cuando Shadcn/ui soporte oficialmente Tailwind v4                 |
| `next lint` → `eslint` CLI       | `package.json` scripts                                        | `next lint` deprecated en 15.5, se elimina en 16. Documentado como P-001.                                                                      | Antes de actualizar a Next.js 16                                  |

---

## Historial de Versiones

| Versión | Fecha      | Cambios                                                                                                                                                                                 |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-25 | Documento inicial — inventario completo, checklists, estimaciones, DAG de ejecución                                                                                                     |
| 1.1     | 2026-02-25 | Sección A completada: A1 (crypto), A2 (attachment), A3 (email), A4 (PDF), A5 (withValidation), A6 (scripts), A7 (cache invalidation). Estado actual y tabla de pendientes actualizados. |
