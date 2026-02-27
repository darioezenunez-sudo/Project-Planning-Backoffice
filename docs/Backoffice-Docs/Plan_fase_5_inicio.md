# Plan: Fase 5 — Integración de pantallas V0 al proyecto principal

## Contexto

Fases 0–4 completadas (230+ tests, todos los API routes funcionando en `src/app/api/v1/`).
Las 13 pantallas de Fase 5 fueron generadas con v0.dev y viven en `V0 zip´s/dashboard/` como
un proyecto Next.js aislado con Tailwind v4 y datos hardcodeados.

**Objetivo:** migrar esas pantallas a `src/` siguiendo todas las convenciones ya establecidas,
sin modificar ningún código de Fases 0–4.

**Branch de trabajo:** `feat/fase-5` (el usuario crea: `git checkout -b feat/fase-5 develop`)

---

## Hallazgos críticos del análisis

| Problema                                                                     | Impacto                                                                                                                          | Solución                                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| V0 usa Tailwind **v4** (globals.css con `@import`, `@theme inline`, `oklch`) | Solo afecta globals.css — los componentes .tsx usan clases estándar idénticas en v3 y v4                                         | **No copiar** `globals.css` ni `components/ui/` de V0; usar el globals.css del proyecto principal   |
| V0's `components/ui/` generados para v4                                      | Pueden contener patrones incompatibles con v3                                                                                    | Instalar cada componente con `npx shadcn@latest add` en el proyecto principal (zinc, v3)            |
| `--sidebar-*` CSS vars ausentes en globals.css del proyecto                  | App shell usa clases `bg-sidebar`, `text-sidebar-foreground`, etc.                                                               | Añadir vars `--sidebar-*` en formato hsl en `src/app/globals.css` y colores en `tailwind.config.ts` |
| V0 no usa `size-*` ni `inset-*` (clases v4-only)                             | Cero incompatibilidades en JSX                                                                                                   | Portabilidad directa de los archivos .tsx                                                           |
| Datos hardcodeados en todos los componentes V0                               | Nada conectado a la API real                                                                                                     | Reemplazar con TanStack Query + hooks propios                                                       |
| Paquetes faltantes                                                           | `next-intl`, `@tanstack/react-query`, `recharts`, `zustand`, `react-hook-form`, `sonner`, `@tiptap/*`, `next-themes`, `date-fns` | `pnpm add` (ver Step 1)                                                                             |

---

## Archivos que NO se tocan (Fases 0–4)

```
src/modules/**      src/lib/**       src/app/api/**
src/schemas/**      prisma/**        supabase/**
src/contracts/**    src/stores/auth-store.ts
```

---

## Archivos que se modifican o crean (Fase 5)

```
tailwind.config.ts                    ← añadir sidebar.* + state color tokens
src/app/globals.css                   ← añadir --sidebar-* CSS vars (hsl, zinc palette)
src/app/layout.tsx                    ← añadir providers (Query, Theme); mantener Analytics/SpeedInsights
src/middleware.ts                     ← extender con next-intl routing
src/app/(auth)/login/page.tsx         ← reemplazar stub
src/app/(auth)/register/page.tsx      ← reemplazar stub
src/app/(dashboard)/layout.tsx        ← reemplazar stub con shell real
src/app/(dashboard)/page.tsx          ← dashboard home
src/app/(dashboard)/companies/...     ← páginas (list, [id])
src/app/(dashboard)/products/[id]/... ← página
src/app/(dashboard)/echelons/[id]/... ← página + consolidation
src/app/(dashboard)/audit-log/...     ← página
src/app/(dashboard)/budget/...        ← página
src/app/(dashboard)/devices/...       ← página
src/app/(dashboard)/settings/...      ← página
src/components/layout/sidebar.tsx     ← reemplazar stub
src/components/layout/header.tsx      ← reemplazar stub
src/components/ui/**                  ← componentes shadcn (zinc + v3, via CLI)
src/components/screens/**             ← componentes de pantalla (portados de V0)
src/components/shared/**              ← loading/error/empty states reutilizables
src/hooks/use-companies.ts (+ más)    ← TanStack Query hooks por entidad
src/i18n/**                           ← routing + messages es/en
```

---

## Step 0 — Branch (manual)

```bash
git checkout -b feat/fase-5 develop
```

---

## Step 1 — Instalar paquetes faltantes

```bash
pnpm add next-intl @tanstack/react-query @tanstack/react-query-devtools @tanstack/react-table
pnpm add react-hook-form @hookform/resolvers recharts zustand
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit
pnpm add @tiptap/extension-placeholder @tiptap/extension-character-count
pnpm add sonner next-themes date-fns
```

**Commit:** `chore(deps): install fase-5 frontend packages`

---

## Step 2 — Design tokens: tailwind.config.ts + globals.css

### tailwind.config.ts — añadir en `colors`:

```typescript
sidebar: {
  DEFAULT: 'hsl(var(--sidebar))',
  foreground: 'hsl(var(--sidebar-foreground))',
  primary: 'hsl(var(--sidebar-primary))',
  'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  accent: 'hsl(var(--sidebar-accent))',
  'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  border: 'hsl(var(--sidebar-border))',
  ring: 'hsl(var(--sidebar-ring))',
},
```

### src/app/globals.css — añadir vars en `:root` y `.dark`:

```css
/* :root */
--sidebar: 240 4.8% 95.9%;
--sidebar-foreground: 240 5.9% 10%;
--sidebar-primary: 240 5.9% 10%;
--sidebar-primary-foreground: 0 0% 98%;
--sidebar-accent: 240 4.8% 95.9%;
--sidebar-accent-foreground: 240 5.9% 10%;
--sidebar-border: 240 5.9% 90%;
--sidebar-ring: 240 10% 3.9%;

/* .dark */
--sidebar: 240 5.9% 10%;
--sidebar-foreground: 0 0% 98%;
--sidebar-primary: 217.2 91.2% 59.8%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 240 3.7% 15.9%;
--sidebar-accent-foreground: 0 0% 98%;
--sidebar-border: 240 3.7% 15.9%;
--sidebar-ring: 217.2 91.2% 59.8%;
```

**Commit:** `feat(config): add sidebar design tokens and state color palette`

---

## Step 3 — Instalar componentes shadcn/ui (zinc, v3)

Ejecutar en el directorio raíz del proyecto principal (NO en V0):

```bash
npx shadcn@latest add accordion alert alert-dialog avatar badge breadcrumb
npx shadcn@latest add button card calendar carousel chart checkbox collapsible
npx shadcn@latest add command context-menu dialog drawer dropdown-menu
npx shadcn@latest add form hover-card input input-otp label menubar
npx shadcn@latest add navigation-menu pagination popover progress radio-group
npx shadcn@latest add resizable scroll-area select separator sheet skeleton
npx shadcn@latest add slider sonner switch table tabs textarea toast toaster
npx shadcn@latest add toggle toggle-group tooltip
```

Después, portar manualmente los componentes custom de V0 (no existen en shadcn):

- `src/components/ui/spinner.tsx` (from V0 `components/spinner.tsx`)
- `src/components/ui/empty.tsx` (from V0 `components/empty.tsx`)

**Commit:** `feat(ui): add shadcn component library and custom ui primitives`

---

## Step 4 — Setup next-intl

Archivos a crear:

- `src/i18n/routing.ts` — `defineRouting({ locales: ['es', 'en'], defaultLocale: 'es' })`
- `src/i18n/request.ts` — `getRequestConfig` con cookie-based locale
- `src/i18n/messages/es.json` — todas las cadenas del proyecto en español
- `src/i18n/messages/en.json` — traducciones al inglés

Actualizar `src/middleware.ts`: envolver `updateSession` con `createI18nMiddleware`.

**Commit:** `feat(config): setup next-intl i18n routing with es/en messages`

---

## Step 5 — App Shell (Sidebar + Header + Dashboard Layout)

### src/components/layout/sidebar.tsx

Portar desde V0 `app-sidebar.tsx`. Cambios respecto al original:

- Reemplazar hrefs hardcodeados con rutas reales (`/dashboard`, `/companies`, `/echelons`, `/devices`, `/budget`, `/audit-log`, `/settings`)
- Añadir `usePathname()` para determinar ítem activo (no prop)
- Obtener nombre de organización desde hook/context (no hardcodeado)
- Botón colapsar: estado manejado por Zustand store (`sidebar-store.ts`)

### src/components/layout/header.tsx

Portar desde V0 `app-header.tsx`. Cambios:

- Avatar + nombre del usuario desde `useAuth()` hook (`src/hooks/use-auth.ts`)
- Dropdown con opción "Cerrar sesión" → llama `supabase.auth.signOut()`
- Bell button conectado a notificaciones (placeholder por ahora)

### src/app/(dashboard)/layout.tsx

Reemplazar stub con layout real:

```tsx
<div className="flex h-screen overflow-hidden">
  <AppSidebar />
  <div className="flex flex-1 flex-col overflow-hidden">
    <AppHeader breadcrumbs={...} />
    <main className="flex-1 overflow-y-auto p-6">{children}</main>
  </div>
</div>
```

**Commit:** `feat(ui): implement app shell sidebar header and dashboard layout`

---

## Step 6 — Providers en root layout

`src/app/layout.tsx` — envolver con:

```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
  <QueryProvider>
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  </QueryProvider>
</ThemeProvider>
```

`src/components/providers/query-provider.tsx` ya existe → verificar que esté correctamente implementado con `QueryClient` y `ReactQueryDevtools`.

**Commit:** incluir en commit del Step 5 o Step 7.

---

## Step 7 — Auth pages

### src/app/(auth)/login/page.tsx

**Construir desde spec** `FASE5_SCREENS.md Chat 1` (no existe archivo .tsx en V0).
Spec: full-viewport centrado, fondo dark con patrón de puntos, Card con logo, email+password+forgot-password,
error alert, Loader2 loading state, texto "No tenés acceso, contactá al administrador."
Conectar a `POST /api/v1/auth/login`. Usar `react-hook-form` + Zod schema desde `src/schemas/user.schema.ts`.

### src/app/(auth)/register/page.tsx

Portar diseño de V0 (Chat 13). Conectar a Supabase Auth `signUp`.
Email readonly desde query param `?email=...` (invitation flow).

**Commit:** `feat(pages): add login and register auth screens`

---

## Step 8 — Hooks de datos (TanStack Query)

Crear hooks en `src/hooks/` que llaman a los API routes existentes:

```typescript
// Patrón por hook
export function useCompanies(params?: CompanyListQuery) {
  return useQuery({
    queryKey: ['companies', params],
    queryFn: () => fetch(`/api/v1/companies?${new URLSearchParams(params)}`).then((r) => r.json()),
    staleTime: 30_000,
  });
}
```

Hooks a crear:

- `use-companies.ts` → GET `/api/v1/companies`, `/companies/:id`
- `use-products.ts` → GET `/api/v1/products/:id`
- `use-echelons.ts` → GET `/api/v1/echelons/:id`, POST transitions
- `use-sessions.ts` → GET `/api/v1/sessions/:id`, `/echelons/:id/sessions`
- `use-summaries.ts` → GET/PATCH `/api/v1/sessions/:id/summary`
- `use-required-fields.ts` → GET `/api/v1/echelons/:id/required-fields`
- `use-devices.ts` → GET `/api/v1/auth/devices`
- `use-budget.ts` → GET `/api/v1/usage`
- `use-audit.ts` → _(endpoint pendiente en Fase 6, usar mock hasta entonces)_

Tipos inferidos siempre desde `src/schemas/*.schema.ts`.

**Commit:** `feat(hooks): add tanstack-query data hooks for all entities`

---

## Step 9 — Migración de pantallas (ordenado por dependencia)

Para cada pantalla: crear el componente en `src/components/screens/[domain]/` y
actualizar el `page.tsx` correspondiente en `src/app/(dashboard)/`.

**Regla de cada componente:**

1. Reemplazar todos los datos mock con el hook correspondiente
2. Añadir estado `isLoading` → `<SkeletonTable />` o `<SkeletonCard />`
3. Añadir estado `isError` → `<ErrorAlert message={...} />`
4. Añadir estado vacío → `<EmptyState icon={...} message={...} cta={...} />`
5. Tipos desde `src/schemas/`, nunca manuales
6. Strings via `useTranslations()` de next-intl

### Pantallas y commits:

| Commit                                               | Pantallas                           | Archivos clave                                    |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `feat(pages): add dashboard home screen`             | `/dashboard`                        | `screens/dashboard/*.tsx`, `(dashboard)/page.tsx` |
| `feat(pages): add companies list and detail screens` | `/companies`, `/companies/[id]`     | `screens/companies/*.tsx`                         |
| `feat(pages): add product detail screen`             | `/products/[id]`                    | `screens/products/*.tsx`                          |
| `feat(pages): add echelon detail core screen`        | `/echelons/[id]`                    | `screens/echelons/echelon-detail.tsx`             |
| `feat(pages): add session detail and summary editor` | `/sessions/[id]`                    | `screens/sessions/*.tsx`                          |
| `feat(pages): add consolidation review screen`       | `/echelons/[id]/consolidation`      | `screens/echelons/consolidation-review.tsx`       |
| `feat(pages): add devices budget and audit screens`  | `/devices`, `/budget`, `/audit-log` | `screens/devices/*.tsx`, etc.                     |
| `feat(pages): add settings profile screen`           | `/settings`                         | `screens/settings/*.tsx`                          |

---

## Step 10 — Estados sistemáticos (loading / error / empty)

Crear componentes reutilizables en `src/components/shared/`:

- `skeleton-table.tsx` — filas en gris animadas para tablas
- `skeleton-card.tsx` — card placeholder
- `error-alert.tsx` — `<Alert variant="destructive">` con retry button
- `empty-state.tsx` — icono + heading + descripción + CTA button

Aplicar a todas las pantallas del Step 9.

**Commit:** `feat(ui): add systematic loading error and empty state components`

---

## Step 11 — Tests

### Component tests (Testing Library ≥70%)

Archivos en `tests/unit/ui/` o `src/components/screens/**/*.test.tsx`:

- Login form: validación de campos, submit, error state
- Companies table: render con datos, filtro, paginación
- Echelon detail: tabs, FSM action bar rendering por estado
- Summary editor: Tiptap render, cambio de estado

### E2E Playwright

Archivo: `tests/e2e/happy-path.spec.ts`
Flow: login → /dashboard → /companies → /products → /echelons/[id] → sesión → summary → consolidate → close

**Commit:** `test(ui): add component tests for screen components`
**Commit:** `test(e2e): add playwright e2e happy path`

---

## Verificación final

```bash
pnpm validate   # lint + type-check + 230+ tests previos deben seguir en verde
pnpm dev        # 13 pantallas sin errores en browser
pnpm build      # build de producción sin errores
```

Checklist manual (task 5.24 del ROADMAP):

- [ ] Dark mode funcional en todas las pantallas
- [ ] Responsive en 375px para Dashboard, Echelon, Session
- [ ] Sin `any` ni `as` fuera de tests (TypeScript strict)
- [ ] Sin strings hardcodeados (todos via next-intl)
- [ ] Sin datos mock en producción (todos via TanStack Query)

---

## Secuencia completa de commits (17 commits)

```
1. chore(deps): install fase-5 frontend packages
2. feat(config): add sidebar design tokens and state color palette
3. feat(ui): add shadcn component library and custom ui primitives
4. feat(config): setup next-intl i18n routing with es/en messages
5. feat(ui): implement app shell sidebar header and dashboard layout
6. feat(pages): add login and register auth screens
7. feat(hooks): add tanstack-query data hooks for all entities
8. feat(pages): add dashboard home screen with stats and charts
9. feat(pages): add companies list and detail screens
10. feat(pages): add product detail screen
11. feat(pages): add echelon detail core screen with fsm action bar
12. feat(pages): add session detail and summary editor screen
13. feat(pages): add consolidation review screen
14. feat(pages): add devices budget and audit screens
15. feat(pages): add settings profile screen
16. feat(ui): add systematic loading error and empty state components
17. test(ui): add component tests and playwright e2e happy path
```
