# Product Backlog — Project-Planning Backoffice

> **Versión:** 1.0 | **Creado:** 2026-03-02 | **Branch:** develop
> Issues identificados post-Fase 7. Organizados en fases de implementación por prioridad e impacto.
> Estado actual del sistema: 334 unit tests · 26/26 E2E · `pnpm validate` green

---

## Índice de Fases

| Fase                                       | Nombre            | Impacto    | Esfuerzo estimado |
| ------------------------------------------ | ----------------- | ---------- | ----------------- |
| [A](#fase-a--quick-wins)                   | Quick Wins        | Alto       | < 1 sesión        |
| [B](#fase-b--mutation-hooks)               | Mutation Hooks    | Alto       | 2–3 sesiones      |
| [C](#fase-c--conectar-botones-a-mutations) | Conectar Botones  | Alto       | 2–3 sesiones      |
| [D](#fase-d--ux-flows)                     | UX Flows          | Medio-Alto | 3–4 sesiones      |
| [E](#fase-e--user-management)              | User Management   | Medio      | 2 sesiones        |
| [F](#fase-f--rich-content)                 | Rich Content      | Medio      | 3–4 sesiones      |
| [G](#fase-g--branding--visual)             | Branding & Visual | Medio      | 2–3 sesiones      |
| [H](#fase-h--realtime--infra)              | Realtime & Infra  | Bajo-Medio | 2–3 sesiones      |

---

## Fase A — Quick Wins

> Issues críticos de bajo esfuerzo. Resolvibles en < 1 sesión de trabajo.

### A1 — Fix `staleTime: 5_000` en hooks de queries

**Tipo:** Bug | **Prioridad:** 🔴 ALTA | **Esfuerzo:** 15 min

**Problema:** `staleTime: 5_000` (5 segundos) en hooks individuales anula el default global de 30 segundos configurado en `QueryProvider`. Esto causa re-fetches agresivos innecesarios.

**Archivos afectados:**

- `src/hooks/use-sessions.ts` línea 27 — `useSession`
- `src/hooks/use-summaries.ts` línea 26 — `useSummaryBySession`

**Fix:** Eliminar la línea `staleTime: 5_000` de ambos hooks (heredarán el default de 30s del QueryProvider).

**Nota:** `use-echelons.ts` ya fue corregido en Fase 7.

---

### A2 — Eliminar logs de debug en network (ruido de red)

**Tipo:** Cleanup | **Prioridad:** 🔴 ALTA | **Esfuerzo:** 30 min

**Problema:** Varios `console.log` y `logger.debug` de depuración temporal generan ruido en los logs de producción y en el network tab del browser.

**Archivos a revisar:**

- `tests/e2e/api-smoke.spec.ts` — debug logging temporal
- Handlers de `/api/v1/context/[echelonId]/route.ts` — logs de diagnóstico agregados durante debugging

**Fix:** Eliminar o convertir a `logger.debug` solo si el contexto es relevante para observabilidad.

---

### A3 — FSM-aware action bar en Echelon Detail

**Tipo:** Feature/Bug | **Prioridad:** 🔴 ALTA | **Esfuerzo:** 2–3h

**Problema:** `echelon-detail-content.tsx` tiene un TODO: `{/* Action bar — TODO: botones según estado FSM */}`. Los botones de acción son siempre los mismos sin importar el estado del echelon.

**FSM del Echelon:**

```
OPEN → IN_PROGRESS → CLOSING → CLOSURE_REVIEW → CLOSED
                                    ↓ (único backward)
                               IN_PROGRESS
```

**Botones por estado:**
| Estado | Acciones disponibles |
|--------|---------------------|
| `OPEN` | Iniciar (→ IN_PROGRESS), Editar, Eliminar |
| `IN_PROGRESS` | Cerrar (→ CLOSING), Editar |
| `CLOSING` | Enviar a revisión (→ CLOSURE_REVIEW) |
| `CLOSURE_REVIEW` | Aprobar (→ CLOSED), Rechazar (→ IN_PROGRESS) |
| `CLOSED` | Solo lectura — sin acciones |

**Archivos:** `src/components/screens/echelons/echelon-detail-content.tsx`

**Dependencia:** Requiere mutation hook (Fase B — `useEchelonTransition`)

---

### A4 — Checkbox `isMet` de RequiredField con handler real

**Tipo:** Bug | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 1h

**Problema:** Los checkboxes de `RequiredField` en echelon detail son display-only (sin `onChange`). No hay forma de marcar un campo como completado desde la UI.

**Archivos:** `src/components/screens/echelons/echelon-detail-content.tsx`
**Dependencia:** Requiere `useUpdateRequiredField` (Fase B)

---

## Fase B — Mutation Hooks

> Actualmente solo existen `useCreateCompany` y `useUpdateSummary` como mutations reales. El resto de entidades son read-only desde la UI.

### B1 — Hooks de Sesión

**Tipo:** Feature | **Prioridad:** 🔴 ALTA | **Esfuerzo:** 1–2h

**Archivo:** `src/hooks/use-sessions.ts`

Hooks a crear:

- `useCreateSession(echelonId)` — POST `/api/v1/echelons/:id/sessions`
- `useDeleteSession(echelonId)` — DELETE `/api/v1/sessions/:id` (soft delete)

---

### B2 — Hooks de RequiredField

**Tipo:** Feature | **Prioridad:** 🔴 ALTA | **Esfuerzo:** 1–2h

**Archivo:** `src/hooks/use-required-fields.ts` (nuevo)

Hooks a crear:

- `useRequiredFields(echelonId)` — GET `/api/v1/echelons/:id/required-fields`
- `useCreateRequiredField(echelonId)` — POST
- `useUpdateRequiredField()` — PATCH `/api/v1/required-fields/:id` (isMet, label, etc.)
- `useDeleteRequiredField()` — DELETE

---

### B3 — Hooks de Echelon (mutaciones)

**Tipo:** Feature | **Prioridad:** 🔴 ALTA | **Esfuerzo:** 2–3h

**Archivo:** `src/hooks/use-echelons.ts`

Hooks a agregar:

- `useCreateEchelon(productId)` — POST `/api/v1/products/:id/echelons`
- `useUpdateEchelon()` — PATCH `/api/v1/echelons/:id`
- `useDeleteEchelon()` — DELETE `/api/v1/echelons/:id`
- `useEchelonTransition()` — PATCH `/api/v1/echelons/:id/transition` (FSM: acción + versión)

**Nota:** `useEchelonTransition` es el más crítico — desbloquea el action bar (Fase A — A3).

---

### B4 — Hooks de Compañía (mutaciones completas)

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 1–2h

**Archivo:** `src/hooks/use-companies.ts`

`useCreateCompany` ya existe. Hooks a agregar:

- `useUpdateCompany()` — PATCH `/api/v1/companies/:id`
- `useDeleteCompany()` — DELETE `/api/v1/companies/:id`

---

### B5 — Hooks de Producto

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 1–2h

**Archivo:** `src/hooks/use-products.ts` (nuevo o existente)

Hooks a crear:

- `useProducts(companyId)` — GET
- `useCreateProduct(companyId)` — POST
- `useUpdateProduct()` — PATCH
- `useDeleteProduct()` — DELETE

---

### B6 — Hooks de Consolidación

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 1h

**Archivo:** `src/hooks/use-consolidation.ts` (nuevo)

Hooks a crear:

- `useConsolidate(echelonId)` — POST `/api/v1/echelons/:id/consolidate` (dispara AI)
- `useApproveSummary(sessionId)` — PATCH FSM: EDITED/REVIEW → VALIDATED

---

### B7 — Hooks de Attachments

**Tipo:** Feature | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 1–2h

**Archivo:** `src/hooks/use-attachments.ts` (nuevo)

Hooks a crear:

- `useAttachments(echelonId)` — GET lista
- `useUploadAttachment()` — POST (multipart/form-data)
- `useDeleteAttachment()` — DELETE

---

### B8 — Hooks de Dispositivos

**Tipo:** Feature | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 1h

**Archivo:** `src/hooks/use-devices.ts` (nuevo o existente)

Hooks a agregar:

- `useUpdateDevice()` — PATCH (nombre, estado)
- `useRevokeDevice()` — DELETE

---

### B9 — Hooks de Presupuesto

**Tipo:** Feature | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 1–2h

**Archivo:** `src/hooks/use-budget.ts` (nuevo)

Hooks a crear:

- `useBudget(echelonId)` — GET summary/actual/planned
- `useCreateBudgetEntry()` — POST
- `useUpdateBudgetEntry()` — PATCH

---

## Fase C — Conectar Botones a Mutations

> Todos los botones actuales en el UI son visuales sin `onClick`. Esta fase los conecta a los hooks de Fase B, agrega confirmaciones y toasts.

### C1 — Echelon Detail: botones de contenido

**Archivo:** `src/components/screens/echelons/echelon-detail-content.tsx`

| Botón                | Acción                  | Hook                     |
| -------------------- | ----------------------- | ------------------------ |
| "Agregar campo"      | Abre form → POST        | `useCreateRequiredField` |
| "Nueva sesión"       | Abre form → POST        | `useCreateSession`       |
| "Editar" (echelon)   | Abre modal → PATCH      | `useUpdateEchelon`       |
| "Eliminar" (echelon) | Confirm dialog → DELETE | `useDeleteEchelon`       |
| "Subir adjunto"      | File picker → POST      | `useUploadAttachment`    |
| Checkbox `isMet`     | onChange → PATCH        | `useUpdateRequiredField` |

---

### C2 — Company List: botones de acción

**Archivo:** `src/components/screens/companies/companies-list.tsx`

| Botón            | Acción           | Hook               |
| ---------------- | ---------------- | ------------------ |
| Editar empresa   | Modal PATCH      | `useUpdateCompany` |
| Eliminar empresa | Confirm + DELETE | `useDeleteCompany` |

---

### C3 — Settings: edición de perfil

**Archivo:** `src/components/screens/settings/settings-content.tsx`

El panel de Settings muestra email y nombre pero sin formulario de edición.

- Agregar form inline o modal para editar displayName (Supabase Auth `updateUser`)
- Cambio de contraseña con `supabase.auth.updateUser({ password })`

---

### C4 — Toasts y confirmaciones

**Tipo:** UX | **Esfuerzo:** 2–3h

Para todas las mutations:

- `onSuccess` → `toast.success("...")` usando Shadcn `useToast`
- `onError` → `toast.error(error.message)`
- Destructive actions (eliminar, cerrar) → `AlertDialog` de Shadcn antes de ejecutar

---

## Fase D — UX Flows

### D1 — Notificaciones (🔔 Campana en Header)

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 3–4h

**Descripción:** El header tiene un espacio para la campana de notificaciones pero no está implementado.

**Diseño propuesto:**

- Ícono `Bell` de Lucide en el header con badge de contador
- Dropdown con lista de notificaciones recientes (max 10)
- Tipos de notificación:
  - Echelon transitó de estado (ej: "Echelon Q1 2026 está listo para revisión")
  - Consolidación AI completada
  - Nuevo miembro agregado a la org
  - Alerta de presupuesto (≥80%)
- Mark as read / Mark all as read

**Archivos:**

- `src/components/layout/header.tsx` — agregar `NotificationBell`
- `src/components/ui/notification-bell.tsx` — nuevo componente
- `src/hooks/use-notifications.ts` — nuevo hook (GET `/api/v1/notifications`)
- `src/app/api/v1/notifications/route.ts` — nuevo endpoint (o leer de `audit_logs`)

**Nota:** Se puede implementar con `audit_logs` existente como fuente de datos inicial antes de agregar una tabla `notifications` dedicada.

---

### D2 — Breadcrumbs de navegación

**Tipo:** UX | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 2h

**Descripción:** No hay indicación de la jerarquía de navegación. El usuario no sabe dónde está dentro del árbol: Org → Empresa → Producto → Echelon.

**Archivo:** `src/components/layout/breadcrumbs.tsx` (nuevo)

**Implementación:** Componente que usa `usePathname()` para construir breadcrumbs dinámicos, con links a cada nivel.

---

### D3 — Empty States con CTAs

**Tipo:** UX | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 2h

**Descripción:** Listas vacías muestran nada o spinner infinito. Deben mostrar mensaje + botón de acción.

**Pantallas afectadas:**

- `/companies` sin empresas → "Crea tu primera empresa"
- `/echelons` sin echelones → "Crea un echelon para comenzar"
- Echelon detail sin sesiones → "Crea la primera sesión"
- Echelon detail sin required fields → "Agrega los campos requeridos"

---

### D4 — Launch Assistant Modal

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 3h

**Descripción:** El Electron app (Data Plane) necesita un deep link o token para conectarse al backoffice. Este modal genera/copia el token de conexión para que el operador lo pegue en el app de escritorio.

**Diseño:** Modal en echelon detail con:

- Token de conexión (JWT one-time o API key del dispositivo)
- QR code opcional
- Instrucciones de uso
- Expiración del token (24h)

---

### D5 — Flujo de navegación Producto → Echelon

**Tipo:** UX | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 2h

**Descripción:** Desde la pantalla de un producto, no hay forma directa de ver sus echelones. La navegación actual es dispar.

**Fix:** En la pantalla de detalle de producto, agregar una sección con la lista de echelones del producto con acceso directo.

---

## Fase E — User Management

### E1 — Pantalla de Miembros de Organización

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 3–4h

**Descripción:** No existe una pantalla para ver los miembros de la organización actual.

**Archivos:**

- `src/components/screens/members/members-content.tsx` (nuevo)
- `src/app/[locale]/members/page.tsx` (nuevo)
- `src/hooks/use-members.ts` (nuevo) — `useMembers()`, `useInviteMember()`, `useUpdateMemberRole()`, `useRemoveMember()`

**Funcionalidades:**

- Lista de miembros con avatar, nombre, email, rol
- Badge de rol (SUPER_ADMIN, ADMIN, MANAGER, MEMBER, VIEWER)
- Botón "Invitar miembro" → email + selección de rol
- Cambiar rol (PATCH — solo ADMIN o SUPER_ADMIN pueden)
- Eliminar miembro (solo ADMIN/SUPER_ADMIN)

---

### E2 — Flujo de Registro / Onboarding

**Tipo:** Feature | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 3–4h

**Descripción:** No existe un flujo de registro para nuevos usuarios. Actualmente solo se crean via seed o Supabase Dashboard.

**Flujo propuesto:**

1. `/register` → formulario (email, password, nombre)
2. Verificación de email (Supabase Auth)
3. `/onboarding` → crear primera organización o unirse a una existente (via invite link)

---

## Fase F — Rich Content

### F1 — Editor de Texto Enriquecido (Tiptap) para Summaries

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 4–5h

**Descripción:** El editor de summaries ejecutivos es un `<textarea>` simple. El plan original (`DEVELOPMENT_PLAN_MVP.md` §5.10) especificó Tiptap como editor rico.

**Funcionalidades de Tiptap a implementar:**

- Bold, italic, underline
- Headings (H1–H3)
- Bullet list, ordered list
- Blockquote
- Code inline
- Undo/redo

**Archivos:**

- `src/components/ui/rich-text-editor.tsx` (nuevo — wrapper de Tiptap)
- `src/components/screens/sessions/session-summary-editor.tsx` (nuevo o modificar existente)

---

### F2 — Vista de Revisión de Consolidación

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 3h

**Descripción:** Cuando una consolidación AI completa (estado `REVIEW`), el MANAGER/ADMIN debe poder revisar, editar (`EDITED`) y aprobar (`VALIDATED`). No existe esta UI.

**Funcionalidades:**

- Panel side-by-side: contenido raw AI (izquierda) vs edición (derecha)
- Botones: "Aprobar sin cambios" (→ VALIDATED), "Editar y aprobar" (→ EDITED → VALIDATED), "Rechazar" (→ DRAFT)
- Diff visual entre raw y edited

---

### F3 — Galería de Attachments

**Tipo:** Feature | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 2–3h

**Descripción:** No hay UI para ver/gestionar los attachments de un echelon o sesión.

**Funcionalidades:**

- Grid de archivos adjuntos (icono por tipo, nombre, tamaño, fecha)
- Preview para imágenes
- Descarga directa (signed URL)
- Eliminar (con confirmación)

---

### F4 — Charts de Presupuesto

**Tipo:** Feature | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 3h

**Descripción:** La pantalla de presupuesto es read-only sin visualizaciones. El plan original especificó charts de actual vs planificado por período.

**Librerías candidatas:** Recharts (ya puede estar instalada) o @nivo/bar

**Funcionalidades:**

- Bar chart: presupuesto planificado vs ejecutado por período
- Indicador de alerta (🔴 si > 100%, 🟡 si > 80%)
- Tabla de breakdown por línea de presupuesto

---

## Fase G — Branding & Visual

### G1 — Toggle Dark/Light Mode en UI

**Tipo:** Feature | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 1–2h

**Descripción:** `theme-provider.tsx` existe pero no hay forma de cambiar el tema desde la interfaz. El usuario está atrapado en el tema que cargó inicialmente.

**Implementación:**

- Botón `Moon`/`Sun` de Lucide en el header (junto al avatar)
- Persiste preferencia en `localStorage`
- `ThemeProvider` ya está configurado con `next-themes`

**Archivo:** `src/components/layout/header.tsx` — agregar `ThemeToggle`

---

### G2 — Design Tokens y Paleta de Colores

**Tipo:** Refactor | **Prioridad:** 🟡 MEDIA | **Esfuerzo:** 3–4h

**Descripción:** El backoffice usa los colores zinc default de Shadcn/ui sin una identidad visual propia.

**Cambios propuestos:**

- Definir paleta de marca (primary, secondary, accent) en `tailwind.config.ts`
- Actualizar tokens en `src/app/globals.css`
- Colores de estado consistentes: `OPEN=blue, IN_PROGRESS=yellow, CLOSING=orange, CLOSURE_REVIEW=purple, CLOSED=green`

---

### G3 — Loading States con Skeletons

**Tipo:** UX | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 2–3h

**Descripción:** Las pantallas muestran spinners genéricos mientras cargan. Los skeletons de Shadcn/ui son más profesionales y reducen el efecto de "flash".

**Archivos a actualizar:** Todos los `*-content.tsx` que tengan `if (isLoading) return <spinner>`

---

### G4 — Tipografía y Jerarquía Visual

**Tipo:** UX/Visual | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 2–3h

**Descripción:** La tipografía es inconsistente entre pantallas. Algunos headings son demasiado grandes, otros muy pequeños.

**Fix:**

- Definir escala tipográfica en `globals.css` (h1–h4, body, caption)
- Aplicar consistentemente en todos los screens
- Alinear con los componentes de Shadcn/ui (que ya tienen una escala)

---

## Fase H — Realtime & Infra

### H1 — Supabase Realtime

**Tipo:** Feature | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 4–6h

**Descripción:** Cuando múltiples usuarios trabajan en la misma org, los cambios de estado (echelon transición, nuevo summary) no se reflejan en tiempo real — solo al refrescar.

**Implementación:**

- Suscribirse a cambios en `echelons` y `sessions` via `supabase.channel()`
- Invalidar TanStack Query cache cuando llega un evento
- Banner de "Actualización disponible" si el usuario tiene la pantalla abierta

---

### H2 — Banner de Conectividad

**Tipo:** UX | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 1h

**Descripción:** Si el usuario pierde conexión, no hay indicación en la UI.

**Implementación:**

- Hook `useOnlineStatus()` con `window.addEventListener('online'/'offline')`
- Banner rojo en la parte superior: "Sin conexión — los cambios no se guardarán"

---

### H3 — Load Testing con Postman/k6

**Tipo:** Infra | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 3–4h

**Descripción:** No se han hecho pruebas de carga en los endpoints críticos.

**Endpoints prioritarios para testear:**

- `GET /api/v1/context/:echelonId` (context bundle — el más pesado)
- `POST /api/v1/echelons/:id/consolidate` (AI call)
- `GET /api/v1/companies` (lista paginada)

**Herramientas:** k6 (script en `scripts/load-test.ts`) o colección Postman

---

### H4 — Sentry Vercel Integration (Sourcemaps)

**Tipo:** Infra | **Prioridad:** 🟢 BAJA | **Esfuerzo:** 30 min

**Descripción:** Sentry SDK ya está instalado. La integración de Vercel (dashboard-only) permite sourcemaps automáticos en cada deploy para stack traces legibles en producción.

**Fix:** Agregar `SENTRY_AUTH_TOKEN` en Vercel project settings → instalar Sentry Vercel Integration desde el marketplace de Sentry.

---

### H5 — pgvector Ranked Retrieval (cuando Assistant esté listo)

**Tipo:** Feature | **Prioridad:** 🔵 DIFERIDO | **Esfuerzo:** 2h

**Descripción:** `src/lib/pgvector.ts` (`findSummaryIdsBySimilarity`) está implementado y testeado. No está integrado porque el Electron app aún no envía `queryEmbedding` en los requests de context bundle.

**Dependencia:** Acuerdo de contrato API con el Electron app (Data Plane).

---

## Criterio de Cierre por Fase

| Fase | Criterio                                                                        |
| ---- | ------------------------------------------------------------------------------- |
| A    | `pnpm validate` green; staleTime corregido; FSM action bar funcional            |
| B    | Todos los hooks listados creados con tests unitarios                            |
| C    | Todos los botones conectados; toasts funcionando; dialogs de confirmación       |
| D    | Notificaciones bell con badge; breadcrumbs en todas las pantallas; empty states |
| E    | Pantalla de miembros funcional; invite + change role + remove                   |
| F    | Tiptap integrado; vista de revisión de consolidación funcional                  |
| G    | Dark mode toggle visible; paleta de marca aplicada                              |
| H    | Realtime suscripciones activas; load test ejecutado                             |

---

## Historial de Versiones

| Versión | Fecha      | Cambios                                                          |
| ------- | ---------- | ---------------------------------------------------------------- |
| 1.0     | 2026-03-02 | Documento inicial — 8 fases, 30 issues identificados post-Fase 7 |
