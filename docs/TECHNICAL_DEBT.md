# Technical Debt — Project-Planning Backoffice

> **Versión:** 2.0 | **Actualizado:** 2026-03-02 | **Estado:** Todo resuelto excepto B8 (diferido post-MVP)
> Fuente original: `docs/legacy/` → `Backoffice-Docs/TECHNICAL_DEBT_PLAN.md` v1.1

---

## Resumen de Estado

| Sección                 | Descripción                                      | Estado                        |
| ----------------------- | ------------------------------------------------ | ----------------------------- |
| **A — Código**          | Items implementables sin infraestructura externa | ✅ 7/7 Completa               |
| **B — Infraestructura** | Items que requerían servicios externos           | ✅ 7/8 Completa · B8 diferido |
| **C — Diferidos**       | Stubs intencionales post-MVP                     | 🔵 Sin cambios                |

---

## Sección A — Resolvibles en Código ✅ COMPLETA

| ID  | Item                                  | Resuelta en | Archivos clave                             |
| --- | ------------------------------------- | ----------- | ------------------------------------------ |
| A1  | crypto.ts AES-256-GCM                 | Fase 1      | `src/lib/utils/crypto.ts`                  |
| A2  | Attachment module completo            | Fase 3      | `src/modules/attachment/`                  |
| A3  | Email adapter (Resend)                | Fase 4      | `src/modules/integration/email.adapter.ts` |
| A4  | PDF adapter (react-pdf)               | Fase 4      | `src/modules/integration/pdf.adapter.ts`   |
| A5  | withValidation params + Zod details   | Fase 1      | `src/lib/middleware/with-validation.ts`    |
| A6  | scripts/ DB operacionales (7 scripts) | Fase 4      | `scripts/db-*.ts`                          |
| A7  | Cache invalidation en VALIDATED       | Fase 6      | `src/lib/cache/context-cache.ts`           |

---

## Sección B — Infraestructura Externa ✅ COMPLETA (excepto B8)

| ID  | Item                     | Estado               | Resuelta en | Notas                                                                   |
| --- | ------------------------ | -------------------- | ----------- | ----------------------------------------------------------------------- |
| B1  | DB migrations (Supabase) | ✅ Resuelto          | Fase 6      | `prisma migrate dev` aplicado; 3 migraciones + partial indexes          |
| B2  | RLS policies SQL         | ✅ Resuelto          | Fase 6      | `supabase/migrations/20260222000001_rls_policies.sql` ejecutado         |
| B3  | Seed data                | ✅ Resuelto          | Fase 6      | `prisma/seed.ts` con Supabase Admin API; 5 users `Test1234!`            |
| B4  | Sentry setup             | ✅ Resuelto          | Fase 6      | `@sentry/nextjs` via wizard; DSN configurado; `tracesSampleRate: 0.2`   |
| B5  | KV Cache implementación  | ✅ Resuelto          | Fase 6      | `@upstash/redis` 1.36.3; Upstash for Redis en Vercel Marketplace (gru1) |
| B6  | withRateLimit (sliding)  | ✅ Resuelto          | Fase 6/7    | Sliding window implementado; bug `'5min'→'5m'` corregido en Fase 7      |
| B7  | Job consumer/worker      | ✅ Resuelto          | Fase 6      | `GET /api/cron/jobs` con `CRON_SECRET` auth                             |
| B8  | Edge Functions           | 🔵 Diferido post-MVP | —           | Reemplazado por Vercel Cron + API route (B7)                            |

---

## Sección C — Diferidos Intencionalmente (No son deuda)

| Item                                   | Estado actual | Cuándo retomar                                  |
| -------------------------------------- | ------------- | ----------------------------------------------- |
| PM Strategy (Jira/Trello)              | 🔵 Diferido   | Cuando se contrate integración PM               |
| Architecture Strategy                  | 🔵 Diferido   | Cuando se necesiten formatos específicos        |
| pgvector ranked retrieval              | 🔵 Diferido   | Cuando el Assistant envíe vectores de embedding |
| Edge Functions (`supabase/functions/`) | 🔵 Diferido   | Si jobs exceden timeout de 10s                  |
| Database webhooks                      | 🔵 Diferido   | Cuando consumidores externos necesiten eventos  |
| Consolidation como Edge Function       | 🔵 Diferido   | Si consolidación excede consistentemente 10s    |
| Prisma 6 → 7                           | 🔵 Diferido   | Post-MVP; breaking change en `prisma.config.ts` |
| Tailwind v3 → v4                       | 🔵 Diferido   | Cuando Shadcn/ui soporte oficialmente v4        |

> **Nota:** `next lint` → `eslint` CLI ya fue resuelto en Fase 7 (B3). Ya no es deuda.

---

## Deuda Conocida Pendiente (post-Fase 7)

Los siguientes items han sido identificados post-Fase 7 y se rastrean en `docs/BACKLOG.md`:

| Prioridad | Item                                                         | Backlog fase |
| --------- | ------------------------------------------------------------ | ------------ |
| 🔴 ALTA   | `staleTime: 5_000` en `use-sessions.ts` y `use-summaries.ts` | Fase A       |
| 🔴 ALTA   | Botones sin `onClick` en echelon detail (FSM action bar)     | Fase A / C   |
| 🟡 MEDIA  | 23+ `useMutation` hooks faltantes                            | Fase B       |
| 🟡 MEDIA  | Formularios de edición en Settings                           | Fase C       |
| 🟢 BAJA   | Dark/light mode toggle en UI                                 | Fase G       |
| 🟢 BAJA   | Sentry Vercel Integration (sourcemaps en deploy)             | Fase H       |

---

## Historial de Versiones

| Versión | Fecha      | Cambios                                                                                                                                                                                                 |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-25 | Documento inicial — inventario, checklists, estimaciones                                                                                                                                                |
| 1.1     | 2026-02-25 | Sección A completada: A1–A7                                                                                                                                                                             |
| 2.0     | 2026-03-02 | Migrado a `docs/TECHNICAL_DEBT.md`. Sección B actualizada (B1-B7 resueltos en Fase 6/7). Formato condensado — checklists de implementación en `docs/legacy/Backoffice-Docs/TECHNICAL_DEBT_PLAN.md` v1.1 |
