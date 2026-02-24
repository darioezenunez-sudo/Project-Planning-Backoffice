# ROADMAP — Estado, Decisiones Pendientes y Próximas Fases

**Versión:** 1.0 · **Fecha:** 2026-02-23 · **Estado:** Activo — documento vivo
**Complementa:** `DEVELOPMENT_PLAN_MVP.md` (fases, tareas, arquitectura) y `ENGINEERING_STANDARDS.md` (reglas de código)
**Propósito:** Registrar el estado real del proyecto, decisiones de proceso pendientes de debate, y la estrategia de branches/commits que aplica desde Fase 3 en adelante.

---

## 1. Estado Actual del Proyecto

### 1.1 Código vs. Commits — Brecha existente

> ⚠️ **Todo el trabajo de Fase 0, 1 y 2 está escrito y validado (`pnpm validate` green, 173 tests passing) pero NO commiteado al repositorio.**

| Fase   | Código         | Tests        | `pnpm validate` | Commit en repo |
| ------ | -------------- | ------------ | --------------- | -------------- |
| Fase 0 | ✅ Completo    | ✅ Passing   | ✅ Green        | ❌ Pendiente   |
| Fase 1 | ✅ Completo    | ✅ 97 tests  | ✅ Green        | ❌ Pendiente   |
| Fase 2 | ✅ Completo    | ✅ 173 tests | ✅ Green        | ❌ Pendiente   |
| Fase 3 | ❌ No iniciada | —            | —               | —              |

**Decisión tomada:** Fase 2 se commitea as-is (un commit por bloque lógico, sin split retroactivo más granular). La convención de commits atómicos por tipo se aplica **a partir de Fase 3**.

### 1.2 Branches — Estado real

Solo existe `main` (local y remoto). El plan en `ENGINEERING_STANDARDS.md §5.5` describe la estrategia de branches pero **nunca fue implementada en el repositorio**.

**Branches a crear antes de arrancar Fase 3 (ver §3).**

---

## 2. Decisiones de Proceso — Pendientes y Tomadas

### 2.1 Estrategia de Commits ✅ Decidido

Cada fase se trabaja en una branch propia (`feat/fase-N`) y los commits se agrupan por tipo de artefacto. Máximo ~10 archivos por commit. Nunca un commit con 40+ archivos mezclados.

**Estructura de commits por fase:**

```
1. feat(fase-N/schema):     Zod schemas + enums                    (~3-5 archivos)
2. feat(fase-N/db):         Prisma schema + migrations + seed       (~2-4 archivos)
3. feat(fase-N/infra):      Repositories                            (~3-6 archivos)
4. feat(fase-N/domain):     Services + state machines               (~4-6 archivos)
5. feat(fase-N/api):        Route handlers                          (~5-8 archivos)
6. test(fase-N):            Unit + integration tests                (~4-8 archivos)
7. docs(fase-N):            ADRs + diagramas actualizados           (~2-4 archivos)
```

Aplica desde Fase 3. Fase 0+1+2 se commitean agrupando todo lo pendiente.

### 2.2 Estrategia de Branches ✅ Decidido

```
main          → Producción. Protected. Solo recibe merges desde develop cuando la fase está validada.
develop       → Integración. Recibe merges de feat/* cuando el CI pasa.
feat/fase-N   → Branch de trabajo por fase. Se abre desde develop. Se cierra con PR a develop.
qa            → Branch de regresión. Se sincroniza desde develop antes de cada merge a main.
                (Debate pendiente — ver §2.4)
```

**Flujo por fase:**

```
develop → feat/fase-N  (branch de trabajo)
    ↓
feat/fase-N → develop  (PR cuando CI verde + pnpm validate green)
    ↓
develop → qa           (sincronización para regresión)
    ↓
qa → main              (merge a producción post-validación)
```

**Regla crítica:** Nunca pushear directo a `main`. Nunca pushear directo a `develop` sin PR.

### 2.3 QA con GitHub Actions ✅ En debate

**Posición acordada:** Apalancarse en GitHub Actions para automatizar la mayor parte del QA, evitando que el solo dev deba hacer manualmente lo que una máquina puede verificar.

**Lo que GitHub Actions ya hace (CI actual):**

- Lint + type-check + build en cada PR

**Lo que falta agregar:**

- `pnpm test:coverage` con threshold configurable por fase
- `pnpm test:integration` (cuando existan tests de integración)
- E2E con Playwright (Fase 5+)

**Pendiente de debate:** ¿Tiene sentido tener una rama `qa` si estás solo?

- **Argumento a favor:** La branch `qa` actúa como "staging pre-main". Permite hacer una regresión manual rápida antes del merge definitivo, y es el lugar donde se fusionan hotfixes sin afectar el trabajo en `develop`.
- **Argumento en contra:** Si el CI es robusto, `develop` ya es el staging. Una branch `qa` adicional agrega overhead de merge sin valor diferencial cuando sos el único dev.
- **Propuesta provisional:** Mantener el flujo `feat/* → develop → main`. Agregar `qa` solo si el proyecto escala a más devs o si se necesita un ambiente de staging separado con datos de producción.

> ⚙️ **Explorar:** Claude Code via MCP en GitHub Actions para análisis automático de PR (revisar patterns, detectar desvíos del ENGINEERING_STANDARDS). Investigar disponibilidad antes de Fase 3.

### 2.4 Skills y Herramientas de Productividad 🔴 Requiere clarificación

**Contexto:** En el debate mencionaste "las que ya existen dentro de skills.sh". Ese archivo **no existe** en el repositorio ni en el sistema. No hay tampoco un directorio `.claude/commands/`.

**Lo que sí existe:**

- Claude Code skills built-in (ej: el skill `keybindings-help` disponible vía `/`)
- La descripción de skills en `ENGINEERING_STANDARDS.md §12` (solo documentación, sin implementación)

**Pendiente de respuesta tuya:**

- ¿A qué archivo o herramienta te referías con "skills.sh"?
- Una vez clarificado, decidir si creamos `.claude/commands/` con skills propios del proyecto o usamos solo los built-in de Claude Code.

### 2.5 Pencil (Diseño) ✅ Decidido

**Cuándo:** Al inicio de Fase 5 (Frontend), antes de generar código con v0.dev.

**Rol definido:**

| Herramienta     | Momento        | Propósito                                                                |
| --------------- | -------------- | ------------------------------------------------------------------------ |
| **Pencil**      | Inicio Fase 5  | Wireframes de las 13 pantallas. Design tokens. Layout del design system. |
| **v0.dev**      | Durante Fase 5 | Scaffolding de componentes Shadcn/ui a partir del diseño ya definido.    |
| **Claude Code** | Durante Fase 5 | Integración del código generado con la lógica de dominio existente.      |

**Acceso:** Pencil está disponible como extensión en Cursor y como MCP en Claude Code.

**Instrucciones de uso** (precisas, dado que no tenés experiencia previa):

> Se documentarán al inicio de Fase 5 con un workflow paso a paso: cómo abrir un archivo `.pen`, cómo usar el sistema de componentes, cómo definir tokens, y cómo mapear las 13 pantallas del plan.

---

## 3. Plan de Implementación de Branches (Acción inmediata)

Antes de iniciar Fase 3, crear la estructura de branches. Orden:

```bash
# 1. Desde main (estado actual), crear develop
git checkout -b develop
git push -u origin develop

# 2. Commitear todo el trabajo pendiente de Fase 0+1+2 sobre develop
#    (ver §3.1 para el plan de commits de deuda técnica)

# 3. Para Fase 3, abrir la branch de trabajo
git checkout -b feat/fase-3
git push -u origin feat/fase-3
```

### 3.1 Commits de Deuda Técnica (Fase 0+1+2)

Como excepción acordada, el trabajo de Fase 0+1+2 se commitea con granularidad reducida directamente sobre `develop`. Se sugieren estos grupos:

```
feat(fase-0+1/infra):   Toolchain, middleware, auth, RBAC, audit, idempotency
feat(fase-1/domain):    Org, Company, Product, Member modules (service + repo + routes)
feat(fase-1/tests):     Tests Fase 1 (97 tests)
feat(fase-2/schema):    Echelon, Session, Summary schemas + FSMs
feat(fase-2/domain):    Echelon, Session, Summary, RequiredField, DecisionLink
feat(fase-2/api):       Route handlers Fase 2
feat(fase-2/tests):     Tests Fase 2 (173 tests total)
```

---

## 4. Fases Restantes — Vista Rápida

Para el plan completo de cada fase ver `DEVELOPMENT_PLAN_MVP.md`.

| Fase       | Descripción                                                         | Estado         | Branch                    |
| ---------- | ------------------------------------------------------------------- | -------------- | ------------------------- |
| **Fase 3** | Assistant Integration Contracts (devices, context bundle, pgvector) | ❌ No iniciada | `feat/fase-3` (por crear) |
| **Fase 4** | Async Jobs + Integration Engine + AI Consolidation                  | ❌ No iniciada | `feat/fase-4`             |
| **Fase 5** | Web Admin Frontend (13 pantallas)                                   | ❌ No iniciada | `feat/fase-5`             |
| **Fase 6** | Security Hardening + Production Readiness                           | ❌ No iniciada | `feat/fase-6`             |
| **Fase 7** | Testing Quality Gate + E2E + Load Test                              | ❌ No iniciada | `feat/fase-7`             |

### 4.1 Deuda técnica de Fase 2 (no bloqueante, pero a resolver antes de Fase 3)

Estos ítems de Fase 2 están incompletos o pendientes de configuración de infra:

| Item             | Descripción                                                               | Prioridad                       |
| ---------------- | ------------------------------------------------------------------------- | ------------------------------- |
| 2.12 Attachments | Upload Supabase Storage + signed URLs + bucket policies                   | Media (no bloquea Fase 3)       |
| 2.13 Cache KV    | Vercel KV para echelon detail reads + `revalidateTag`                     | Media (requiere KV configurado) |
| DB migrations    | `pnpm db:migrate` (requiere DATABASE_URL + DIRECT_URL live)               | Alta antes de Fase 3            |
| RLS policies     | `supabase/migrations/20260222000001_rls_policies.sql` aplicar en Supabase | Alta antes de Fase 3            |
| Seed             | `pnpm db:seed` post-migrate                                               | Media                           |
| Sentry           | Setup pendiente desde Fase 0.18 (requiere cuenta + DSN)                   | Media                           |

### 4.2 Pre-requisitos para iniciar Fase 3

- [ ] Branches creadas (`develop`, `feat/fase-3`)
- [ ] Deuda técnica Fase 2 comprometida al repo
- [ ] `DATABASE_URL` + `DIRECT_URL` configurados (para migrations)
- [ ] Supabase project activo con RLS aplicado
- [ ] `skills.sh` clarificado (ver §2.4)

---

## 5. Definition of Done por Fase

A partir de Fase 3, una fase se considera cerrada cuando:

1. ✅ `pnpm validate` green (lint + tsc + todos los tests)
2. ✅ Coverage ≥ target de la fase (ver `DEVELOPMENT_PLAN_MVP.md` por fase)
3. ✅ PR de `feat/fase-N` → `develop` mergeado con CI verde
4. ✅ Commits atómicos por tipo (ver §2.1) — no commits de 40+ archivos
5. ✅ Si hay nuevas decisiones técnicas → ADR correspondiente en `docs/adr/`
6. ✅ Si hay nuevos diagramas requeridos → actualizados (ver `ENGINEERING_STANDARDS.md §13`)
7. ✅ Regresión manual rápida sobre `develop` antes de mergear a `main`

---

## 6. Registro de Debates — Sesión 2026-02-23

| Tema               | Decisión                                                  | Pendiente                                        |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| Pencil vs v0.dev   | Pencil para wireframes inicio Fase 5, v0 para scaffolding | Workflow detallado al inicio de Fase 5           |
| QA automatizado    | GitHub Actions + CI. Explorar Claude Code MCP en Actions  | Definir si `qa` branch tiene sentido en solo-dev |
| Commit strategy    | Commits atómicos por tipo, ~10 archivos max, desde Fase 3 | —                                                |
| Branch strategy    | `main / develop / feat/fase-N`, PR obligatorio            | Crear branches antes de iniciar Fase 3           |
| Fase 2 retroactivo | No retroactivo — se commitea as-is                        | Ejecutar los commits de deuda técnica            |
| Skills             | Pendiente clarificación de "skills.sh"                    | Respuesta del usuario                            |

---

## 7. Historial de Versiones

| Versión | Fecha      | Cambios                                             |
| ------- | ---------- | --------------------------------------------------- |
| 1.0     | 2026-02-23 | Documento inicial — resultado del debate de proceso |
