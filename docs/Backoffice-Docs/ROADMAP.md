# ROADMAP — Estado, Decisiones Pendientes y Próximas Fases

**Versión:** 1.4 · **Fecha:** 2026-02-24 · **Estado:** Activo — documento vivo
**Complementa:** `DEVELOPMENT_PLAN_MVP.md` (fases, tareas, arquitectura) y `ENGINEERING_STANDARDS.md` (reglas de código)
**Propósito:** Registrar el estado real del proyecto, decisiones de proceso tomadas y pendientes, y la estrategia de branches/commits que aplica desde Fase 3 en adelante.

> Este documento es la **fuente de verdad de proceso** para retomar el desarrollo en cualquier sesión futura.
> Para arquitectura y tareas detalladas, ver `DEVELOPMENT_PLAN_MVP.md`.

---

## 1. Estado Actual del Proyecto

### 1.1 Código vs. Commits — Estado real

| Fase   | Código      | Tests        | `pnpm validate`         | Commit en repo                    |
| ------ | ----------- | ------------ | ----------------------- | --------------------------------- |
| Fase 0 | ✅ Completo | ✅ Passing   | ✅ Green                | ✅ En `develop`                   |
| Fase 1 | ✅ Completo | ✅ 97 tests  | ✅ Green                | ✅ En `develop`                   |
| Fase 2 | ✅ Completo | ✅ 173 tests | ✅ Green                | ✅ En `develop`                   |
| Fase 3 | ✅ Completo | ✅ 184 tests | ✅ Green (post-commits) | 🔄 Por commitear en `feat/fase-3` |

### 1.2 Branches — Estado real

| Branch        | Estado                                            |
| ------------- | ------------------------------------------------- |
| `main`        | ✅ Existe en remoto. Solo recibe merges validados |
| `develop`     | ✅ Existe local y remoto. Fase 0+1+2 commiteadas  |
| `feat/fase-3` | ✅ Existe local. Branch de trabajo activa         |

---

## 2. Decisiones de Proceso

### 2.1 Estrategia de Commits ✅ Decidido

Cada fase se trabaja en `feat/fase-N`. Los commits se agrupan por **capa funcional**. El contexto de fase queda implícito en el nombre de la branch.

**Estructura de commits por fase:**

```
feat(schema):    Zod schemas + enums                        (~3-5 archivos)
feat(db):        Prisma schema + migrations + seed           (~2-4 archivos)
feat(infra):     Repositories                               (~3-6 archivos)
feat(domain):    Services + state machines                  (~4-6 archivos)
feat(api):       Route handlers                             (~5-8 archivos)
test:            Unit + integration tests                   (~4-8 archivos)
docs:            ROADMAP + ADRs actualizados                (~2-4 archivos)
```

**Reglas:**

- Máximo ~10 archivos por commit
- Nunca `git add .`
- Siempre verificar con `git diff --staged --name-only` antes de commitear
- Scopes permitidos en `commitlint.config.ts`: `auth | ci | deps | config | schema | domain | infra | api | db | test | ui | components | pages | echelon | session | summary | budget | device | integration | docs | roadmap`

**Skill disponible:** `/phase-commit` guía el proceso paso a paso.

### 2.2 Estrategia de Branches ✅ Decidido e implementado

```
main          → Producción. Protected. Solo recibe merges desde develop cuando la fase está validada.
develop       → Integración. Recibe merges de feat/* cuando el CI pasa.
feat/fase-N   → Branch de trabajo por fase. Se abre desde develop. Se cierra con PR a develop.
```

**Flujo por fase:**

```
develop → feat/fase-N  (branch de trabajo)
    ↓
feat/fase-N → develop  (PR cuando CI verde + pnpm validate green)
    ↓
develop → main         (merge a producción post-validación manual)
```

**Regla crítica:** Nunca pushear directo a `main`. Nunca pushear directo a `develop` sin PR.

**Nota sobre rama `qa`:** Descartada por ahora. Para un solo dev con CI robusto, `develop` ya cumple el rol de staging. Se agrega si escala a más devs o se necesita ambiente de staging con datos reales.

### 2.3 QA con GitHub Actions ✅ En curso

**Lo que ya existe:**

- Lint + type-check + build en cada PR (`.github/workflows/`)

**Lo que falta agregar (antes de Fase 5):**

- `pnpm test:coverage` con threshold por fase
- `pnpm test:integration` cuando existan tests de integración
- E2E con Playwright (Fase 7)

**Explorar:** Claude Code via MCP en GitHub Actions para análisis automático de PR (detectar desvíos de `ENGINEERING_STANDARDS`). Investigar disponibilidad antes de Fase 4.

### 2.4 Skills — Claude Code Project Commands ✅ Implementado

Los skills son archivos Markdown en `.claude/commands/` que Claude ejecuta cuando el usuario escribe `/nombre-del-skill`. Garantizan consistencia en workflows repetitivos sin improvisación del LLM.

**Skills disponibles:**

| Skill             | Comando         | Propósito                                            |
| ----------------- | --------------- | ---------------------------------------------------- |
| `new-module.md`   | `/new-module`   | Checklist de 7 pasos para crear un módulo de dominio |
| `phase-commit.md` | `/phase-commit` | Secuencia de commits atómicos para cerrar una fase   |

### 2.5 Pencil (Diseño UI) ✅ Decidido

**Cuándo:** Al inicio de Fase 5 (Frontend), antes de generar código con v0.dev.

| Herramienta     | Momento        | Propósito                                                                |
| --------------- | -------------- | ------------------------------------------------------------------------ |
| **Pencil**      | Inicio Fase 5  | Wireframes de las 13 pantallas. Design tokens. Layout del design system. |
| **v0.dev**      | Durante Fase 5 | Scaffolding de componentes Shadcn/ui a partir del diseño ya definido.    |
| **Claude Code** | Durante Fase 5 | Integración del código generado con la lógica de dominio existente.      |

**Acceso:** Extensión en Cursor y MCP en Claude Code.
**Instrucciones de uso:** Se documentarán al inicio de Fase 5 con un workflow paso a paso.

### 2.6 Internacionalización (i18n) ✅ Decidido

El backoffice soporta **Español (default) e Inglés**. Aplica tanto a la UI como a los mensajes de la API (errores de validación, respuestas del servidor). La preferencia del usuario también se comunica al asistente de IA.

#### Decisiones tomadas

| Decisión               | Elección                             | Motivo                                                                   |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| Librería               | **next-intl**                        | Purpose-built para App Router, TS type-safe, server + client components  |
| Routing                | **Cookie-based** (sin cambio de URL) | El backoffice no se indexa; `/dashboard` no necesita `/es/dashboard`     |
| Idioma default         | **Español**                          | Idioma primario de los usuarios                                          |
| Fallback               | Inglés si clave no existe en es.json | Previene pantallas en blanco                                             |
| Preferencia persistida | **DB + cookie**                      | DB para sincronizar entre dispositivos; cookie para la sesión activa     |
| Textos API             | ✅ También multilenguaje             | Mensajes de error y validaciones se traducen según el locale del request |

#### Estructura de archivos

```
messages/
  es.json     ← diccionario español (idioma primario)
  en.json     ← diccionario inglés
```

Los archivos son JSON flat/anidado con todas las claves de UI y mensajes de API. TypeScript infiere las claves → error en compilación si una clave no existe en un idioma.

#### Cómo se comunica el locale al asistente de IA

La preferencia del usuario se lee en el middleware y se inyecta como instrucción explícita en el system prompt del asistente:

```typescript
// En el servicio de IA
const systemLocaleInstruction =
  locale === 'es' ? 'Respond always in Spanish.' : 'Respond always in English.';
```

El asistente **no detecta** el idioma — recibe instrucción explícita. Esto evita que el asistente cambie de idioma por el contenido del mensaje.

#### Cuándo se implementa

**Inicio de Fase 5**, como primer paso antes de generar ningún componente UI. El setup de i18n debe estar en su lugar antes de que v0.dev genere cualquier texto hardcodeado.

**Tareas concretas de Fase 5 que dependen de este setup:**

1. Instalar `next-intl` y configurar middleware de locale
2. Crear `messages/es.json` y `messages/en.json` vacíos
3. Agregar campo `preferredLocale` al modelo `User` en Prisma (o en `OrganizationMember`)
4. Selector de idioma en la UI (componente de settings del usuario)
5. Hook `useLocale()` + `useTranslations()` disponible para todos los componentes

---

## 3. Deuda Técnica — Pendiente antes de Fase 3

Estos ítems de Fase 2 están incompletos o requieren configuración de infra externa:

| Item          | Descripción                                                               | Prioridad                              |
| ------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| DB migrations | `pnpm db:migrate` (requiere `DATABASE_URL` + `DIRECT_URL` live)           | ⚠️ Alta — bloquea seed y tests reales  |
| RLS policies  | `supabase/migrations/20260222000001_rls_policies.sql` aplicar en Supabase | ⚠️ Alta — antes de cualquier dato real |
| Seed          | `pnpm db:seed` post-migrate                                               | Media                                  |
| Sentry        | Setup pendiente desde Fase 0.18 (requiere cuenta + DSN)                   | Media                                  |
| Attachments   | Upload Supabase Storage + signed URLs + bucket policies (Fase 2.12)       | Media — no bloquea Fase 3              |
| Cache KV      | Vercel KV para echelon detail reads (Fase 2.13)                           | Media — requiere KV configurado        |

### 3.1 Fase 3 — Ítems diferidos (documentado)

Los siguientes ítems del plan Fase 3 se dejaron **diferidos** con justificación. Quedan documentados para retomarlos cuando corresponda.

| Ítem (plan)                                                   | Decisión                             | Justificación                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3.10 API Key encryption (AES-256-GCM)**                     | Diferido                             | Cifrado de API keys de terceros en DB y entrega segura por Machine-ID requiere diseño de key derivation y rotación. Para MVP, GET /auth/devices/:machineId devuelve un token opaco de corta vida (15 min); es suficiente para que el Assistant llame al resto de endpoints. Implementación completa cuando existan integraciones externas (Jira, etc.) que requieran keys en DB. |
| **3.12 Rate limits reales (Upstash)**                         | Stub activo                          | `withRateLimit` existe pero no aplica límites (pasa la request). Requiere Vercel KV o Upstash configurado y clave por `machineId`/userId. Plan: implementar en Fase 6 (Security) o cuando KV esté operativo; hasta entonces el stub no bloquea desarrollo.                                                                                                                       |
| **Ranked retrieval por similarity (pgvector en GET context)** | Helper listo, no integrado en bundle | `src/lib/pgvector.ts` expone `findSummaryIdsBySimilarity(echelonId, orgId, queryEmbedding, limit)`. El context-bundle actual ordena por estado (VALIDATED primero) y trunca por tokens. Cuando el Assistant envíe un `queryEmbedding` (ej. en query param o body), el GET context puede usar el helper para ordenar summaries por similitud; requiere acuerdo de contrato.       |
| **Contract test E2E (3.13)**                                  | Diferido a Fase 7                    | El plan Fase 7 incluye "Contract test: Assistant — Simulate full Assistant flow". Los tests unitarios de device y budget (184 tests totales) cubren la lógica; el flujo E2E enroll → validate → context → N summaries → usage se validará en Fase 7 con Playwright o similar.                                                                                                    |

**Invalidación de cache de contexto:** Implementada. Se invalida en: POST /sessions/:id/summary (creación), PATCH /required-fields/:id (cambio de RequiredFields). Cuando exista un endpoint de transición de summary (ej. PATCH summary con evento VALIDATE), ese handler debe llamar a `invalidateContextCache(echelonId)` tras transición a VALIDATED.

---

## 4. Fases Restantes — Vista Rápida

Para el plan completo de cada fase ver `DEVELOPMENT_PLAN_MVP.md`.

| Fase       | Descripción                                                         | Estado         | Branch        |
| ---------- | ------------------------------------------------------------------- | -------------- | ------------- |
| **Fase 3** | Assistant Integration Contracts (devices, context bundle, pgvector) | 🔄 Activa      | `feat/fase-3` |
| **Fase 4** | Async Jobs + Integration Engine + AI Consolidation                  | 🔄 En progreso | `feat/fase-4` |
| **Fase 5** | Web Admin Frontend (13 pantallas) + i18n setup                      | ❌ No iniciada | `feat/fase-5` |
| **Fase 6** | Security Hardening + Production Readiness                           | ❌ No iniciada | `feat/fase-6` |
| **Fase 7** | Testing Quality Gate + E2E + Load Test                              | ❌ No iniciada | `feat/fase-7` |

---

## 5. Definition of Done por Fase

A partir de Fase 3, una fase se considera cerrada cuando:

1. ✅ `pnpm validate` green (lint + tsc + todos los tests)
2. ✅ Coverage ≥ target de la fase (ver `DEVELOPMENT_PLAN_MVP.md`)
3. ✅ PR de `feat/fase-N` → `develop` mergeado con CI verde
4. ✅ Commits atómicos por tipo (ver §2.1) — no commits de 40+ archivos
5. ✅ Si hay nuevas decisiones técnicas → registradas en este ROADMAP
6. ✅ Si hay nuevos diagramas requeridos → actualizados (`ENGINEERING_STANDARDS.md §13`)
7. ✅ Regresión manual rápida sobre `develop` antes de mergear a `main`

---

## 6. Registro de Decisiones

| Tema                | Decisión                                                            | Pendiente                                              |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| Pencil vs v0.dev    | Pencil wireframes inicio Fase 5, v0 scaffolding durante Fase 5      | Workflow detallado al inicio de Fase 5                 |
| QA automatizado     | GitHub Actions + CI. Explorar Claude Code MCP en Actions            | Investigar Claude Code MCP en Actions antes de Fase 4  |
| Rama `qa`           | Descartada por ahora para solo-dev                                  | Revisar si escala a más devs                           |
| Commit strategy     | Commits atómicos por capa funcional, ~10 archivos max, desde Fase 3 | —                                                      |
| Branch strategy     | `main / develop / feat/fase-N`, PR obligatorio                      | —                                                      |
| Skills Claude Code  | `.claude/commands/` con `/new-module` y `/phase-commit`             | —                                                      |
| i18n — librería     | `next-intl` con cookie-based routing                                | Implementar al inicio de Fase 5                        |
| i18n — idiomas      | Español (default) + Inglés. Fallback: inglés                        | —                                                      |
| i18n — persistencia | DB + cookie para preferencia de usuario                             | Agregar `preferredLocale` al modelo `User` en Fase 5   |
| i18n — API messages | También multilenguaje (errores, validaciones)                       | Implementar junto con la UI en Fase 5                  |
| i18n — asistente IA | Instrucción explícita en system prompt, no detección automática     | Implementar en Fase 4 (cuando se integre el asistente) |

---

## 8. Guía de commits Fase 3 (end-to-end)

Ejecutar desde la raíz del repo, en branch `feat/fase-3`. Antes de cada commit: `git diff --staged --name-only` (máx. ~10 archivos) y `pnpm validate` antes del primer push.

### Orden de commits

**Commit 1 — feat(schema):** Zod schemas + contratos Assistant

```
Archivos a incluir:
  src/schemas/device.schema.ts
  src/schemas/usage.schema.ts
  src/contracts/assistant-api.ts

Mensaje:
feat(schema): add device, usage and assistant-api contracts for Fase 3
```

**Commit 2 — feat(db):** pgvector migration + Prisma

```
Archivos a incluir:
  prisma/schema.prisma
  prisma/migrations/20260224120000_add_pgvector_embedding/migration.sql

Mensaje:
feat(db): add pgvector embedding to executive_summaries for Fase 3
```

**Commit 3 — feat(infra):** Repositories

```
Archivos a incluir:
  src/modules/auth/device.repository.ts
  src/modules/budget/budget.repository.ts
  src/modules/decision-link/decision-link.repository.ts
  src/modules/session/session.repository.ts

Mensaje:
feat(infra): add device and budget repos, findManyForEchelon and findManyByIds for Fase 3
```

**Commit 4 — feat(domain):** Services + cache + pgvector helper

```
Archivos a incluir:
  src/modules/auth/device.service.ts src/modules/budget/budget.service.ts src/modules/context-bundle/context-bundle.service.ts src/modules/echelon/echelon.service.ts src/modules/summary/summary.repository.ts src/modules/summary/summary.service.ts
  src/lib/cache/context-cache.ts src/lib/pgvector.ts

Mensaje:
feat(domain): device, budget, context-bundle services; summary embedding; echelon transition; context cache
```

**Commit 5 — feat(api):** Route handlers

```
Archivos a incluir:
  src/app/api/v1/auth/devices/route.ts
  src/app/api/v1/auth/devices/[machineId]/route.ts
  src/app/api/v1/context/[echelonId]/route.ts
  src/app/api/v1/echelons/[id]/launch/route.ts
  src/app/api/v1/sessions/[id]/summary/route.ts
  src/app/api/v1/usage/route.ts
  src/app/api/v1/required-fields/[id]/route.ts

Mensaje:
feat(api): Fase 3 routes — devices, context, launch, summary idempotent, usage; context cache invalidation
```

**Commit 6 — test:** Unit tests

```
Archivos a incluir:
  tests/unit/modules/device.service.test.ts
  tests/unit/modules/budget.service.test.ts
  tests/unit/modules/session.service.test.ts
  tests/unit/modules/summary.service.test.ts

Mensaje:
test(device): add device and budget service unit tests; session findManyByIds and summary createWithEmbedding mocks
```

**Commit 7 — docs:** ROADMAP + diagramas

```
Archivos a incluir:
  docs/Backoffice-Docs/ROADMAP.md
  docs/diagrams/sequence-device-enrollment.mermaid
  docs/diagrams/sequence-launch-assistant.mermaid
  docs/diagrams/sequence-session-lifecycle.mermaid

Mensaje:
docs(roadmap): Fase 3 status, deferred items, commit guide; add sequence diagrams for device, launch, session
```

### Cierre de Fase 3

1. Tras el último commit: `pnpm validate` (debe estar verde).
2. Push: `git push -u origin feat/fase-3`.
3. Abrir PR `feat/fase-3` → `develop`; esperar CI verde.
4. Merge a `develop`; regresión manual rápida si se desea.
5. Actualizar este ROADMAP §1.1: Fase 3 ✅ En `develop`.

---

## 8.1 Fase 4 — Implementación y diferidos

**Implementado en `feat/fase-4`:**

- **4.1 Job queue:** Tabla `jobs` (Prisma), enums `JobType`/`JobStatus`, migración. Repo + service con retry (exponential backoff) y dead letter (3 intentos).
- **4.2 Vercel AI SDK:** `ai` + `@ai-sdk/openai`, `src/lib/ai/provider.ts` con `generateText` + `Output.object` (Zod), token tracking. `CONSOLIDATION_MAX_INPUT_TOKENS` para límite.
- **4.3 Consolidation Engine:** En backoffice (no Edge Function): servicio de consolidación que recoge summaries VALIDATED, construye prompt, llama LLM, persiste reporte en `echelon.consolidatedReport` y transición a CLOSURE_REVIEW. Límite de tokens → 413.
- **4.4 Consolidation prompt:** `src/lib/ai/consolidation.prompt.ts` (6 capas: role, context, summaries, output rules, format). Schema Zod en `consolidation.schema.ts`.
- **4.5 / 4.6 PDF y Email:** Jobs encolados (tipo PDF, EMAIL). Adapters en backoffice siguen como stubs; la ejecución real queda para Edge Functions (Supabase) o worker que consuma la cola.
- **4.7 Integration Strategy Engine:** Strategy pattern por `config_blueprint.type`; default = PDF + email (enqueue 2 jobs); PM y Architecture = stubs que delegan al default.
- **4.8 Database Webhooks:** No implementado; configurable en Supabase (echelon.state / executive_summary created) cuando se disponga del entorno.
- **4.9 Budget alerts:** Tras `POST /usage`, si `BUDGET_LIMIT_TOKENS_PER_ORG_MONTH` está definido, se comprueba uso vs límite y se encola job `BUDGET_ALERT` si ≥ 80%.
- **4.10 Retry + Dead Letter:** En job service: 3 intentos, backoff exponencial, estado DEAD_LETTER al agotar.
- **4.11 Tests:** Unit tests para `job.service` (enqueue, markFailed, retry, listReadyToRun) e `integration.engine` (selección de estrategia por tipo).

**Diferido (Fase 4+):**

- Consolidation como Edge Function (Supabase) para evitar timeout 10s en Vercel; actualmente se ejecuta en la misma request de `POST /consolidate`.
- Invocación de Edge Functions desde Postgres (pg_net) al insertar en `jobs`; actualmente los jobs solo se encolan y un worker externo o cron podría consumirlos.
- Database webhooks (triggers) para notificación al cambiar `echelon.state` o crear `executive_summary`.
- Implementación real de PDF (react-pdf + Storage) y Email (Resend + templates) en Edge Functions.

---

## 9. Historial de Versiones

| Versión | Fecha      | Cambios                                                                                                         |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-23 | Documento inicial — resultado del debate de proceso                                                             |
| 1.1     | 2026-02-24 | Actualización post-commits: Fase 0+1+2 commiteadas, branches creadas, skills activas                            |
| 1.2     | 2026-02-24 | Decisiones de i18n: next-intl, cookie-based, es default, DB+cookie, API multilingual                            |
| 1.3     | 2026-02-24 | Fase 3 implementada: estado, ítems diferidos documentados, guía de commits end-to-end; diagramas secuencia      |
| 1.4     | 2026-02-24 | Fase 4 implementada: jobs, AI consolidation, integration engine, budget alerts; §8.1 implementación y diferidos |
