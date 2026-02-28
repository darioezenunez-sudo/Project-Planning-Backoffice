# Fase 5 — Prompts Completos para v0.app

**Versión:** 2.0 · **Fecha:** 2026-02-26
**Reemplaza:** v1.0 (que contenía placeholders `[PEGAR PROMPT BASE AQUÍ]`)
**Propósito:** 13 prompts listos para copiar y pegar en v0.app — sin ensamblado, sin placeholders.

---

## Cómo usar este documento

1. **Paso 0** (una sola vez): configurá el tema del nuevo proyecto v0 con los valores de la sección siguiente.
2. Para cada pantalla: abrí un **chat nuevo** dentro del mismo proyecto v0.
3. Copiá **todo el contenido** de la sección correspondiente y pegalo en el chat.
4. v0 genera el componente → tab "Code" → copiás a un archivo separado.
5. La integración con las API routes reales se hace después con Claude Code.

> ⚠️ No reutilices chats anteriores. Cada pantalla = un chat nuevo dentro del proyecto.

---

## Paso 0 — Configurar el tema del proyecto v0 (hacer UNA sola vez)

Creá un proyecto nuevo en v0.app **sin conectar GitHub**. Luego en **Theme → Customize**, cargá:

### Typography

| Campo     | Valor   |
| --------- | ------- |
| Font Sans | `Geist` |

### Other

| Campo                                | Valor                       |
| ------------------------------------ | --------------------------- |
| Radius                               | `0.5 rem`                   |
| Shadow X / Y / Blur / Spread / Color | `0 / 1 / 2 / 0 / #0000000d` |

### Colors — solo modificar los marcados con ⚠️

| Campo                                                                                          | Valor a ingresar              |
| ---------------------------------------------------------------------------------------------- | ----------------------------- |
| ⚠️ Primary                                                                                     | `oklch(0.6231 0.1882 264.05)` |
| ⚠️ Primary Foreground                                                                          | `oklch(0.9850 0 0)`           |
| ⚠️ Ring                                                                                        | `oklch(0.6231 0.1882 264.05)` |
| ⚠️ Chart 1                                                                                     | `oklch(0.6231 0.1882 264.05)` |
| ⚠️ Chart 2                                                                                     | `oklch(0.6964 0.1491 162.48)` |
| ⚠️ Chart 3                                                                                     | `oklch(0.7692 0.1655 72.43)`  |
| ⚠️ Chart 4                                                                                     | `oklch(0.7039 0.1961 47.60)`  |
| ⚠️ Chart 5                                                                                     | `oklch(0.6024 0.2008 292.72)` |
| ✅ Secondary, Accent, Background, Foreground, Card, Muted, Destructive, Border, Input, Sidebar | No cambiar                    |

---

## Orden de construcción

| Chat # | Pantalla                           | Ruta                           |
| ------ | ---------------------------------- | ------------------------------ |
| 1      | Login                              | `/login`                       |
| 2      | Dashboard Home                     | `/dashboard`                   |
| 3      | Companies List                     | `/companies`                   |
| 4      | Company Detail                     | `/companies/[id]`              |
| 5      | Product Detail                     | `/products/[id]`               |
| 6      | Echelon Detail _(scaffold visual)_ | `/echelons/[id]`               |
| 7      | Session + Summary Editor           | `/sessions/[id]`               |
| 8      | Consolidation Review               | `/echelons/[id]/consolidation` |
| 9      | Device Management                  | `/devices`                     |
| 10     | Budget Dashboard                   | `/budget`                      |
| 11     | Audit Log Viewer                   | `/audit`                       |
| 12     | Settings / Profile                 | `/settings`                    |
| 13     | Register (invitación)              | `/register`                    |

---

## Chat 1 · Login · `/login`

> Pantalla de autenticación. Sin sidebar ni header. Pantalla completa centrada.

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500 (botones, focus rings)
Convenciones: Cards rounded-xl shadow-sm border · texto de error con Alert variant="destructive" · todo el texto en español (Argentina)

---

Diseñá la pantalla de Login de un backoffice SaaS empresarial.
Sin sidebar. Sin header. Div full-viewport (min-h-screen) centrado vertical y horizontalmente.

FONDO: dark, patrón sutil de puntos (bg-dot o similar) en zinc-800/20 cubriendo toda la pantalla.

CONTENIDO CENTRADO (max-w-[400px] w-full mx-auto px-4, flex flex-col items-center gap-6):

1. Encabezado sobre el card (fuera del card):
   - Ícono cuadrado con fondo blue-500/10 y rounded-xl, dentro: ícono LayoutDashboard (blue-500, 28px)
   - "Project Planning Backoffice" (text-xl font-semibold, text-center)
   - "Área de administración" (text-sm text-muted-foreground, text-center)

2. Card (w-full rounded-xl border shadow-sm p-6 flex flex-col gap-4):
   - Título "Iniciar sesión" (text-xl font-semibold)
   - Subtítulo "Ingresá tus credenciales para continuar" (text-sm text-muted-foreground)
   - Alert variant="destructive" con ícono AlertCircle y texto "Credenciales incorrectas. Verificá tu correo y contraseña." (mostrar como visible)
   - Campo Email: Label "Correo electrónico", Input type=email placeholder="tu@empresa.com", ícono Mail (16px, text-muted-foreground) a la izquierda dentro del input
   - Campo Contraseña: Label con flex justify-between — "Contraseña" a la izquierda, link "¿Olvidaste tu contraseña?" (text-sm text-muted-foreground underline) a la derecha; Input type=password con ícono Eye/EyeOff toggle a la derecha
   - Botón primario full-width "Ingresar" (bg-blue-500, hover:bg-blue-600); estado loading: Loader2 animado (animate-spin) + texto "Ingresando..." (botón disabled)

3. Debajo del card:
   - "¿No tenés acceso? Contactá a tu administrador." (text-sm text-muted-foreground text-center)

Exportar como componente React TypeScript. Sin llamadas a API — estado local con useState para toggle de contraseña y simulación de loading/error.
```

---

## Chat 2 · Dashboard Home · `/dashboard`

> Primera pantalla con el layout shell completo. Este chat define el sidebar y header que se repiten en todos los siguientes.

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500 (botones, focus rings, ítem de nav activo)

Badges de estado (Badge variant="outline" + className):
  IN_PROGRESS:    "bg-blue-500/10 text-blue-500 border-blue-500/20"
  CLOSING:        "bg-amber-500/10 text-amber-600 border-amber-500/20"
  CLOSURE_REVIEW: "bg-orange-500/10 text-orange-500 border-orange-500/20"
  CLOSED:         "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Todo el texto en español (Argentina)
  Tipografía — título de página: text-2xl font-semibold tracking-tight · sección: text-lg font-medium · muted: text-sm text-muted-foreground

---

LAYOUT SHELL — definir la estructura completa que se usará en todas las pantallas:

Estructura raíz: div className="flex h-screen overflow-hidden bg-background"

SIDEBAR IZQUIERDO (w-[240px] shrink-0 border-r flex flex-col bg-background):
  Sección tope (p-4, flex items-center gap-2):
    - Ícono Layers (blue-500, 20px) + div con "Project Planning" (text-sm font-semibold) en la primera línea y "Backoffice" (text-xs text-muted-foreground) en la segunda
  Separator horizontal
  Nav (flex-1 p-2 flex flex-col gap-1):
    Cada ítem: Button variant="ghost" className="w-full justify-start gap-3 text-sm h-9"
    Ítems con ícono lucide (16px) + label:
      LayoutDashboard  → "Dashboard"       ← ACTIVO en esta pantalla
      Building2        → "Empresas"
      Layers           → "Echelons"
      Monitor          → "Dispositivos"
      BarChart3        → "Presupuesto"
      ClipboardList    → "Auditoría"
      Settings         → "Configuración"
    Ítem activo (Dashboard): className="w-full justify-start gap-3 text-sm h-9 bg-blue-500/10 text-blue-500 hover:bg-blue-500/10"
    Ítems inactivos: text-muted-foreground
  Base (p-2):
    Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground"
    con ChevronLeft (16px) + "Colapsar"

HEADER TOP (h-14 border-b px-6 flex items-center justify-between bg-background shrink-0):
  Izquierda: Breadcrumb de shadcn/ui — solo "Dashboard" (sin ancestros en esta pantalla)
  Derecha (flex items-center gap-3):
    Button variant="ghost" size="icon" — ícono Bell (18px, text-muted-foreground)
    Separator orientation="vertical" className="h-6"
    Avatar (AvatarFallback "DA", className="bg-blue-500/10 text-blue-500 text-xs font-medium")
    "Dario Acme" (text-sm font-medium)
    ChevronDown (14px, text-muted-foreground)

ÁREA PRINCIPAL (flex-1 overflow-auto):
  div className="p-6" con div className="max-w-7xl mx-auto space-y-6"

---

CONTENIDO DE LA PANTALLA — Dashboard Home:

SECCIÓN 1 — 4 stat cards (grid grid-cols-4 gap-4):
  Card 1: icono Activity (blue-500) — "Echelons Activos" — número "7" (text-3xl font-bold) — "+2 este mes" (text-xs text-muted-foreground)
  Card 2: icono CalendarDays — "Sesiones este mes" — "23" — "+5 vs. mes anterior"
  Card 3: icono FileText — "Summaries Pendientes" — "5" — Badge inline amber-500/10 text-amber-600 "Requieren revisión" (text-xs)
  Card 4: icono Monitor — "Dispositivos Online" — "3" — span con dot verde pulsante (w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block mr-1) + "en línea ahora"
  Cada card: CardHeader con flex justify-between items-start — icono a la derecha (20px, text-muted-foreground) — CardContent con el número grande y el subtexto

SECCIÓN 2 — 2 columnas (grid grid-cols-3 gap-4):
  Columna izquierda col-span-2:
    Card "Uso de tokens — últimos 6 meses"
    CardHeader: título + subtítulo "(tokens × 1.000)" text-muted-foreground text-xs
    CardContent: BarChart Recharts (height=220) con datos:
      [{ mes: "Sep", tokens: 820 }, { mes: "Oct", tokens: 1100 }, { mes: "Nov", tokens: 980 },
       { mes: "Dic", tokens: 1300 }, { mes: "Ene", tokens: 890 }, { mes: "Feb", tokens: 1245 }]
    fill de las barras: "#3b82f6" (blue-500) · grid lines sutiles · tooltip: "Feb: 1.245k tokens · ~$124 est."
    XAxis: dataKey="mes" · YAxis: oculto, valores implícitos

  Columna derecha col-span-1:
    Card "Echelons activos"
    CardHeader: título + Button variant="ghost" size="sm" "Ver todos →" (text-xs)
    CardContent: lista de 4 ítems (flex flex-col divide-y):
      "Fase Levantamiento ERP"          · Badge IN_PROGRESS
      "Arquitectura Microservicios"     · Badge IN_PROGRESS
      "Revisión Performance API"        · Badge CLOSURE_REVIEW
      "Onboarding Módulo HR"            · Badge CLOSING
    Cada ítem: flex justify-between items-center py-2 text-sm · nombre font-medium, badge a la derecha

SECCIÓN 3 — full width:
  Card "Actividad reciente" CardHeader + CardContent
  Lista de 8 entradas (flex flex-col divide-y):
    Cada entrada: flex items-start gap-3 py-3
      Avatar pequeño (h-8 w-8) con iniciales + bg-muted
      div flex-1: texto descripción (text-sm) + timestamp relativo abajo (text-xs text-muted-foreground)
    Entradas ficticias:
      "DA" · "Dario Acme validó el summary de Sesión #4 en Fase Levantamiento ERP" · "hace 5 min"
      "MR" · "María Rodríguez marcó 2 campos como completados en Fase Levantamiento ERP" · "hace 23 min"
      "DA" · "Dario Acme inició el echelon Arquitectura Microservicios" · "hace 1 hora"
      "JL" · "Juan López creó la sesión #5 en Revisión Performance API" · "hace 2 horas"
      "DA" · "Dario Acme creó la empresa RetailMax SRL" · "hace 3 horas"
      "MR" · "María Rodríguez editó el summary de Sesión #2" · "hace 5 horas"
      "DA" · "Dario Acme agregó el producto API Gateway a TechCorp SA" · "hace 1 día"
      "JL" · "Juan López enroló un nuevo dispositivo macOS" · "hace 2 días"

Exportar como componente React TypeScript. Recharts ya instalado. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 3 · Companies List · `/companies`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Tablas: componente Table de shadcn · encabezado sticky
  Confirmar eliminación: Dialog · Button "Cancelar" + Button variant="destructive" "Eliminar"
  Crear/Editar: Sheet desde la derecha · formulario con labels · validación debajo del campo
  Feedback de éxito: Toast bottom-right
  Todo el texto en español (Argentina)
  Tipografía — título de página: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground

LAYOUT SHELL (copiar la misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Empresas" (Building2)
  - Breadcrumb: "Empresas"

---

CONTENIDO DE LA PANTALLA — Companies List:

PAGE HEADER (flex items-center justify-between mb-6):
  "Empresas" (text-2xl font-semibold tracking-tight)
  Button variant="default" (blue-500) "+ Nueva empresa" con ícono Plus (16px) a la izquierda

BARRA DE BÚSQUEDA (mb-4):
  div relative — ícono Search (16px, text-muted-foreground) posicionado absolute left-3 top-1/2 -translate-y-1/2
  Input pl-9 placeholder="Buscar empresa..." className="max-w-sm"

TABLA (Card rounded-xl border shadow-sm):
  CardContent p-0 — Table dentro
  Columnas (TableHead):
    "Empresa"     — ancho: auto
    "Industria"   — ancho: 150px
    "Productos"   — ancho: 100px, text-center
    "Creado"      — ancho: 130px
    ""            — ancho: 48px (acciones)

  4 filas ficticias (TableRow hover:bg-muted/50):
    TechCorp SA        · Software   · Badge "2" (variant outline, text-center)  · 15 Ene 2026 · dropdown
    RetailMax SRL      · Retail     · Badge "1"                                  · 20 Ene 2026 · dropdown
    Fintech Partners   · Finanzas   · Badge "3"                                  · 3 Feb 2026  · dropdown
    Acme Consulting    · Consultoría· Badge "0" (muted)                          · 10 Feb 2026 · dropdown

  Celda "Empresa": Link (text-sm font-medium underline-offset-4 hover:underline)
  Celda "Industria": text-sm text-muted-foreground
  Celda "Productos": Badge variant="outline" centered
  Celda "Creado": text-sm text-muted-foreground
  Celda acciones: Button variant="ghost" size="icon" con MoreHorizontal
    DropdownMenu con: DropdownMenuItem "Ver detalle" (Eye), "Editar" (Edit), DropdownMenuSeparator, DropdownMenuItem "Eliminar" (Trash2, className="text-destructive focus:text-destructive")

PAGINACIÓN (flex items-center justify-between mt-4 px-1):
  "Mostrando 1-4 de 4 empresas" (text-sm text-muted-foreground)
  div gap-2: Button variant="outline" size="sm" disabled "← Anterior" · Button variant="outline" size="sm" "Siguiente →"

SHEET ABIERTO "Nueva empresa" (mostrar como abierto, desde la derecha):
  SheetHeader: SheetTitle "Nueva empresa" · SheetDescription "Completá los datos de la empresa cliente."
  Formulario con campos:
    "Nombre *": Input placeholder="Ej: TechCorp SA" (requerido)
    "Industria": Input placeholder="Ej: Software, Retail, Finanzas"
    "Website": Input type="url" placeholder="https://empresa.com"
    "Descripción": Textarea placeholder="Breve descripción de la empresa..." rows=3 · "0 / 500 caracteres" debajo (text-xs text-muted-foreground)
  SheetFooter: Button variant="outline" "Cancelar" · Button (blue-500) "Guardar empresa"

DIALOG ABIERTO "Confirmar eliminación" (mostrar como abierto, sobre el Sheet):
  DialogHeader: DialogTitle "¿Eliminar empresa?" · DialogDescription "Vas a eliminar RetailMax SRL. Esta acción no se puede deshacer."
  DialogFooter: Button variant="outline" "Cancelar" · Button variant="destructive" "Eliminar empresa"

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 4 · Company Detail · `/companies/[id]`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Tablas: componente Table de shadcn
  Crear/Editar: Sheet desde la derecha
  Confirmar eliminación: Dialog variant="destructive"
  Todo el texto en español (Argentina)
  Tipografía — título de página: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Empresas" (Building2)
  - Breadcrumb: "Empresas" / "TechCorp SA" (el segundo ítem NO es link)

---

CONTENIDO DE LA PANTALLA — Company Detail:

PAGE HEADER (flex items-start justify-between mb-6):
  Bloque izquierdo:
    Fila 1: "TechCorp SA" (text-2xl font-semibold tracking-tight) + Badge variant="outline" "Software" (ml-3, text-sm)
    Fila 2 (flex items-center gap-4 mt-1):
      Link externo (ExternalLink 14px inline): "techcorp.com" (text-sm text-muted-foreground hover:text-foreground)
      "·" separator
      "Creada el 15 Ene 2026" (text-sm text-muted-foreground)
  Botón derecha: Button variant="outline" size="sm" con Edit2 (14px) "Editar empresa"

DESCRIPCIÓN (mb-6):
  p text-sm text-muted-foreground max-w-2xl: "Empresa de desarrollo de software especializada en soluciones ERP para medianas y grandes organizaciones. Partner certificado SAP con más de 15 años de trayectoria."

TABS (componente Tabs de shadcn):
  TabsList: "Productos" con Badge "2" (ml-2, bg-muted text-muted-foreground text-xs rounded-full px-1.5) · "Información"
  Tab activo: "Productos"

  TAB PRODUCTOS:
    Botón "+ Agregar producto" (Button size="sm" blue-500, Plus 14px) alineado a la derecha (flex justify-end mb-4)
    Tabla (Card rounded-xl border shadow-sm, CardContent p-0):
      Columnas: "Producto" · "Descripción" · "Echelons" (100px, text-center) · "" (acciones)
      2 filas:
        "ERP Implementation" · "Implementación del módulo financiero SAP para la..." (truncado, text-muted-foreground) · Badge "3" · dropdown
        "API Gateway Migration" · "Migración de APIs legacy a arquitectura REST con..." · Badge "1" · dropdown
      Celda "Producto": text-sm font-medium link hover:underline
      Dropdown: "Ver detalle" (Eye) · "Editar" (Edit) · separator · "Eliminar" (Trash2, destructive)
    Estado vacío (si no hubiera productos): icono Package (32px, text-muted-foreground/50) centrado + "Sin productos" (text-lg font-medium) + "Agregá el primer producto de esta empresa." (muted) + Button "Agregar producto"

  TAB INFORMACIÓN (mostrar también el contenido en el diseño, aunque no esté activo):
    Grid 2 columnas (grid-cols-2 gap-6):
      Campo "Nombre": label (text-sm font-medium text-muted-foreground) + valor "TechCorp SA" (text-sm)
      Campo "Industria": "Software"
      Campo "Website": Link "techcorp.com" (text-sm text-blue-500)
      Campo "Fecha de creación": "15 de enero de 2026"
      Campo "Descripción" (col-span-2): párrafo completo
    Botón "Editar empresa" al pie

SHEET ABIERTO "Agregar producto":
  SheetHeader: SheetTitle "Agregar producto" · SheetDescription "Nuevo producto para TechCorp SA"
  Campos: "Nombre *" (Input) · "Descripción" (Textarea rows=4 "Descripción del producto o servicio...")
  SheetFooter: Button variant="outline" "Cancelar" · Button blue-500 "Guardar producto"

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 5 · Product Detail · `/products/[id]`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Badges de estado de negocio (Badge variant="outline" + className — usar exactamente estas clases):
  OPEN:           "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
  IN_PROGRESS:    "bg-blue-500/10 text-blue-500 border-blue-500/20"
  CLOSED:         "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Progress: componente Progress de shadcn (h-2)
  Crear con Dialog: cuando el formulario es simple (≤3 campos)
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Empresas" (Building2) — los productos son sub-entidades de empresas
  - Breadcrumb: "Empresas" / "TechCorp SA" (link) / "ERP Implementation" (sin link)

---

CONTENIDO DE LA PANTALLA — Product Detail:

PAGE HEADER (flex items-start justify-between mb-6):
  Bloque izquierdo:
    Fila 1: "ERP Implementation" (text-2xl font-semibold tracking-tight)
    Fila 2 (flex items-center gap-3 mt-1):
      Link hacia la empresa (Building2 14px inline): "TechCorp SA" (text-sm text-muted-foreground hover:text-foreground)
      "·" separator
      "3 echelons" (text-sm text-muted-foreground)
      "·" separator
      "10 sesiones totales" (text-sm text-muted-foreground)
  Botón derecha: Button (blue-500) size="sm" con Plus (14px) "+ Nuevo echelon"

LISTA DE ECHELON CARDS (flex flex-col gap-4):

  Card 1 (rounded-xl border shadow-sm hover:shadow-md transition-shadow):
    CardContent p-5:
      Fila superior (flex items-start justify-between):
        Izquierda: "Fase de Levantamiento de Requerimientos" (text-base font-medium) + Badge IN_PROGRESS debajo (mt-1)
        Derecha: Button variant="ghost" size="sm" "Ver detalle" con ChevronRight (14px)
      Progress bar (mt-3 mb-1): Progress value=60 className="h-2"
      "3 de 5 campos completados" (text-xs text-muted-foreground)
      Fila inferior (flex items-center gap-4 mt-3 text-xs text-muted-foreground):
        CalendarDays (12px) + "4 sesiones"
        "·"
        Clock (12px) + "Última: 20 Feb 2026"

  Card 2:
    "Definición de Arquitectura" · Badge OPEN
    Progress value=0 · "0 de 3 campos completados"
    "0 sesiones · Sin sesiones aún"

  Card 3:
    "Revisión de Performance" · Badge CLOSED
    Progress value=100 (className con color emerald: use [&>div]:bg-emerald-500) · "5 de 5 campos completados"
    "6 sesiones · Cerrado el 10 Feb 2026"

ESTADO VACÍO (mostrar como referencia en un bloque separado al final, con comentario "// Empty state — mostrar cuando no hay echelons"):
  Centrado en la pantalla: ícono Layers (40px, text-muted-foreground/50) + "Sin echelons" (text-lg font-medium) + "Creá el primer echelon para este producto." (muted) + Button blue-500 "+ Nuevo echelon"

DIALOG ABIERTO "Nuevo echelon":
  DialogHeader: "Nuevo echelon" · "Creá un nuevo echelon para ERP Implementation"
  Campos:
    "Nombre *": Input placeholder="Ej: Fase de Levantamiento"
    "Tipo": Select — opciones: "Requerimientos", "Arquitectura", "Performance", "PM", "Otro"
    "Sesiones objetivo": Input type=number placeholder="Ej: 5" min=1
  DialogFooter: Button variant="outline" "Cancelar" · Button blue-500 "Crear echelon"

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 6 · Echelon Detail _(scaffold visual)_ · `/echelons/[id]`

> ⚠️ Este prompt genera el SCAFFOLD visual de la pantalla (estructura, tabs, action bar).
> La lógica FSM condicional de la action bar se integra después con Claude Code.
> Pedile a v0 que muestre el estado IN_PROGRESS como estado activo de ejemplo.

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Badges de estado (Badge variant="outline" + className):
  IN_PROGRESS:    "bg-blue-500/10 text-blue-500 border-blue-500/20"
  OPEN:           "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
  CLOSED:         "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  VALIDATED:      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  DRAFT:          "bg-zinc-400/10 text-zinc-400 border-zinc-400/20"
  REVIEW:         "bg-blue-400/10 text-blue-400 border-blue-400/20"

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Progress: componente Progress de shadcn (h-2)
  Sheet: crear/editar desde la derecha
  Checkbox: componente Checkbox de shadcn
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Echelons" (Layers)
  - Breadcrumb: "ERP Implementation" (link) / "Fase de Levantamiento" (sin link)

---

CONTENIDO DE LA PANTALLA — Echelon Detail:

PAGE HEADER (mb-6):
  Fila 1 (flex items-start justify-between):
    Izquierda: "Fase de Levantamiento de Requerimientos" (text-2xl font-semibold tracking-tight)
    Derecha: Badge IN_PROGRESS (text-sm px-3 py-1)
  Fila 2 (flex items-center gap-4 mt-2):
    Progress bar inline (w-48 h-2) al 60% · "3 de 5 campos completados" (text-sm text-muted-foreground)
    "·"
    CalendarDays (14px) + "4 sesiones" (text-sm text-muted-foreground)
    "·"
    Clock (14px) + "Última: 20 Feb 2026" (text-sm text-muted-foreground)

TABS (componente Tabs, tablist sticky top-14 bg-background z-10 border-b):
  TabsList variant sin fondo (solo underline en el activo):
    "Requerimientos" + Badge "3/5" (bg-muted text-muted-foreground text-xs ml-2) ← ACTIVO
    "Sesiones" + Badge "4"
    "Summaries" + Badge "4"
    "Adjuntos" + Badge "2"

  TAB REQUERIMIENTOS (activo):
    Botón "+ Agregar campo" (Button size="sm" variant="outline", Plus 14px) — flex justify-end mb-4
    Lista de required fields (flex flex-col gap-2):
      Cada campo: Card rounded-lg border p-4 (hover:bg-muted/30)
        flex items-start gap-3:
          Checkbox (checked o unchecked según isMet)
          div flex-1:
            Fila: label del campo (text-sm font-medium) + Badge "Cumplido" (emerald) o "Pendiente" (zinc) a la derecha
            Descripción expandible (text-xs text-muted-foreground mt-1)
            Si cumplido: "Marcado por María Rodríguez · 18 Feb 2026" (text-xs text-muted-foreground)
            DecisionLinks debajo (links pequeños con ícono ExternalLink 12px, text-xs text-blue-500)
          Button variant="ghost" size="icon" MoreHorizontal → dropdown Editar / Eliminar
      5 campos ficticios:
        ✅ "Relevamiento de procesos actuales" — Cumplido — link "Ver documento de relevamiento"
        ✅ "Entrevistas con stakeholders" — Cumplido — link "Acta sesión #1"
        ✅ "Identificación de gaps funcionales" — Cumplido
        ⬜ "Priorización de requerimientos" — Pendiente
        ⬜ "Validación con sponsor del proyecto" — Pendiente

  TAB SESIONES (mostrar también el contenido en el diseño):
    Botón "+ Nueva sesión" (Button size="sm" variant="outline") — flex justify-end mb-4
    Timeline vertical (relative border-l border-muted ml-4):
      4 ítems de sesión, cada uno:
        div relative pl-8: dot absoluto (w-3 h-3 rounded-full bg-blue-500 border-2 border-background, left=-6px top=3px)
        Card rounded-lg border p-4 mb-4:
          Fila: "Sesión #N" (text-sm font-semibold) + fecha a la derecha (text-xs text-muted-foreground)
          Notas: texto breve (text-xs text-muted-foreground mt-1)
          Badge de summary (VALIDATED, DRAFT, REVIEW) + Button ghost size="sm" "Ver resumen →"
      Sesión #4: 20 Feb · VALIDATED · "Se cerraron los requerimientos funcionales del módulo financiero"
      Sesión #3: 15 Feb · EDITED · "Revisión de brechas con el equipo técnico"
      Sesión #2: 8 Feb  · VALIDATED
      Sesión #1: 1 Feb  · VALIDATED · "Primera sesión de relevamiento con stakeholders"

  TAB SUMMARIES (mostrar también):
    Lista de summaries (flex flex-col gap-3):
      4 ítems, cada uno Card p-4:
        Fila superior: "Summary Sesión #N" (font-medium) + Badge estado + fecha (muted, derecha)
        Extracto (text-xs text-muted-foreground mt-1 line-clamp-2): texto de ~120 chars
        Fila inferior (flex gap-2 mt-3):
          Button variant="outline" size="sm" "Ver completo" (Eye 14px)
          Botones de acción según estado:
            DRAFT: Button size="sm" blue-500 "Enviar a revisión"
            REVIEW: Button size="sm" blue-500 "Aprobar" · Button size="sm" variant="outline" "Solicitar edición"
            VALIDATED: solo Badge (sin botones)

  TAB ADJUNTOS (mostrar también):
    Botón "Subir adjunto" (Button size="sm" variant="outline", Upload 14px) — derecha, mb-4
    Grid 3 columnas (grid-cols-3 gap-3):
      2 archivos ficticios, cada uno Card p-3:
        Ícono de tipo: FileText (PDF) o Image según tipo · nombre del archivo (text-sm font-medium truncate)
        Tamaño y fecha (text-xs text-muted-foreground)
        Fila botones: Button ghost size="icon" Download · Button ghost size="icon" Trash2 (text-destructive)

ACTION BAR (sticky bottom-0 border-t bg-background/95 backdrop-blur py-4 px-6):
  flex items-center justify-between
  Izquierda: texto de estado "Estado actual: IN_PROGRESS — 3 de 5 campos completados" (text-sm text-muted-foreground)
  Derecha (flex gap-3):
    Button variant="outline" "Ver consolidación anterior"
    Button blue-500 (con ChevronRight 16px a la derecha) "Consolidar echelon"
    [nota al pie de la action bar como comentario en el código: "// TODO: los botones de la action bar cambian según el estado FSM del echelon"]

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 7 · Session + Summary Editor · `/sessions/[id]`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Badges de estado (Badge variant="outline" + className):
  REVIEW:   "bg-blue-400/10 text-blue-400 border-blue-400/20"
  EDITED:   "bg-violet-500/10 text-violet-500 border-violet-500/20"
  VALIDATED:"bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  DRAFT:    "bg-zinc-400/10 text-zinc-400 border-zinc-400/20"

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Diferencias (diff): texto eliminado: line-through text-red-400 bg-red-500/10 · texto agregado: text-emerald-400 bg-emerald-500/10
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Echelons" (Layers)
  - Breadcrumb: "Fase de Levantamiento" (link) / "Sesión #3" (sin link)

---

CONTENIDO DE LA PANTALLA — Session Detail + Summary Editor:

Diseño de dos paneles lado a lado (flex gap-6), con el panel izquierdo ocupando 65% y el derecho 35%.

PANEL IZQUIERDO (flex flex-col gap-4):

  PAGE HEADER:
    "Summary — Sesión #3" (text-2xl font-semibold tracking-tight)
    "20 de febrero de 2026 · Fase de Levantamiento de Requerimientos" (text-sm text-muted-foreground)

  TABS: "Original IA" · "Editar" ← activo

  TAB ORIGINAL IA (contenido):
    Card rounded-xl border (bg-zinc-900 en dark):
      CardHeader: "Generado por IA" (text-sm font-medium) + Badge con BotIcon (12px) "IA" (bg-zinc-400/10 text-zinc-400) a la derecha + timestamp "25 Feb 2026 · 14:32" (text-xs text-muted-foreground)
      CardContent: texto markdown renderizado (prose-sm, text-sm leading-relaxed):
        ## Resumen Ejecutivo
        En esta sesión se relevaron los procesos actuales de la organización, identificando
        brechas funcionales en los módulos de facturación y contabilidad...
        ## Decisiones Tomadas
        - Se decidió priorizar la migración del módulo financiero en la primera fase
        - Se acordó una reunión de validación con el CFO para la semana siguiente
        ## Próximos Pasos
        1. Preparar documento de requerimientos funcionales
        2. Coordinar entrevista con el equipo de contabilidad

  TAB EDITAR (activo — mostrar por defecto):
    Card rounded-xl border:
      CardHeader: Barra de herramientas Tiptap (div flex items-center gap-1 flex-wrap border-b pb-3 mb-3):
        Grupos de botones (Button variant="ghost" size="icon" h-8 w-8):
          Bold (B) · Italic (I) · Strikethrough (S)
          Separator vertical h-5
          H1 · H2 · H3 (text-xs font-bold)
          Separator vertical h-5
          List (BulletList) · ListOrdered
          Separator vertical h-5
          Undo · Redo
        Badge derecha: "Guardado" (CheckCircle 12px + texto, bg-emerald-500/10 text-emerald-500 text-xs)
      CardContent:
        Área de editor (min-h-[300px] text-sm leading-relaxed outline-none, simular cursor en el texto):
          Mismo contenido que el Original IA pero en modo editable (sin ###, como texto plano con formato visual)
        Pie: "847 caracteres" (text-xs text-muted-foreground text-right mt-2)

    Card rounded-xl border mt-4:
      CardHeader: "Cambios respecto al original" (text-sm font-medium) con diff-icon (GitCompare 14px)
      CardContent text-sm leading-relaxed:
        Ejemplo de diff visual:
        "En esta sesión se relevaron los procesos actuales ~~de la empresa~~ de la organización..."
        Texto tachado en rojo: line-through decoration-red-400 bg-red-500/10 px-0.5 rounded
        Texto nuevo en verde: text-emerald-400 bg-emerald-500/10 px-0.5 rounded

PANEL DERECHO (flex flex-col gap-4):

  Card "Estado del summary":
    CardHeader: "Estado del summary" (text-sm font-medium)
    CardContent:
      Badge REVIEW grande (text-sm px-3 py-1, mb-4, self-start)
      Button full-width blue-500 mb-2: "Aprobar" (CheckCircle 16px)
      Button full-width variant="outline": "Solicitar edición" (RotateCcw 16px)
      Separator my-4
      "Historial de estado:" (text-xs text-muted-foreground font-medium mb-2)
      Timeline pequeño (3 ítems, text-xs text-muted-foreground):
        "25 Feb · Generado (DRAFT)"
        "26 Feb · Enviado a revisión (REVIEW)"
        → "26 Feb · Pendiente de aprobación"

  Card "Información de sesión":
    CardContent (flex flex-col gap-3):
      Fila: "Sesión" · "#3" (font-medium)
      Fila: "Fecha" · "20 Feb 2026"
      Fila: "Echelon" · Link "Fase Levantamiento" (text-blue-500, ExternalLink 12px)
      Fila: "Notas" · "Revisión de brechas con el equipo técnico" (text-xs text-muted-foreground)

  Card "Adjuntos de sesión":
    CardHeader: "Adjuntos" (text-sm font-medium) + Button variant="ghost" size="sm" "Subir" (Upload 14px)
    CardContent:
      2 archivos (flex flex-col gap-2):
        FileText (blue, 16px) + "relevamiento-procesos.pdf" (text-sm truncate) + "245 KB" (muted) + Download button
        Image icon (16px) + "diagrama-flujo.png" (text-sm) + "89 KB" + Download button

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API. El editor Tiptap puede representarse como un div con contentEditable simulado (texto estático visible).
```

---

## Chat 8 · Consolidation Review · `/echelons/[id]/consolidation`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Badges de estado (Badge variant="outline" + className):
  CLOSURE_REVIEW: "bg-orange-500/10 text-orange-500 border-orange-500/20"
  VALIDATED:      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Confirmar acción irreversible: Dialog
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Echelons" (Layers)
  - Breadcrumb: "Fase de Levantamiento" (link) / "Revisión de Consolidación" (sin link)

---

CONTENIDO DE LA PANTALLA — Consolidation Review:

PAGE HEADER (flex items-start justify-between mb-6):
  Izquierda:
    "Revisión de Consolidación" (text-2xl font-semibold tracking-tight)
    "Fase de Levantamiento de Requerimientos · ERP Implementation" (text-sm text-muted-foreground mt-1)
  Derecha: Badge CLOSURE_REVIEW (text-sm px-3 py-1)

Diseño de dos paneles lado a lado (grid grid-cols-2 gap-6):

PANEL IZQUIERDO — Reporte generado por IA:
  Card h-full (flex flex-col):
    CardHeader:
      Título "Reporte generado por IA" (text-lg font-medium)
      Fila (flex items-center gap-2): Badge con Bot (12px) "IA" (bg-zinc-400/10 text-zinc-400) · "Generado el 25 Feb 2026" (text-xs text-muted-foreground)
    CardContent (flex-1 overflow-auto):
      Texto markdown renderizado (prose-sm text-sm leading-relaxed) — contenido rico y realista:
        ## Resumen Ejecutivo del Echelon
        La fase de levantamiento de requerimientos para el proyecto ERP Implementation
        se desarrolló exitosamente en 4 sesiones durante el período enero-febrero 2026...

        ## Decisiones Clave Adoptadas
        1. **Priorización financiera**: El módulo financiero se implementará en la primera fase
        2. **Arquitectura de datos**: Se adoptará un modelo centralizado con API REST
        3. **Validación de sponsor**: CFO validó los requerimientos el 20 de febrero

        ## Métricas del Echelon
        - Sesiones realizadas: 4
        - Campos requeridos completados: 5/5
        - Summaries validados: 4

        ## Próximos Pasos Recomendados
        Iniciar la fase de Definición de Arquitectura con foco en...

      Separator my-4
      "Summaries incluidos (4):" (text-sm font-medium mb-3)
      Lista de 4 summaries (flex flex-col gap-2):
        Cada uno: flex items-center justify-between p-2 rounded-md bg-muted/30
          "Sesión #N · DD Feb 2026" (text-sm) · Badge VALIDATED · Link "Ver →" (text-xs text-blue-500, ExternalLink 12px)

PANEL DERECHO — Revisión y aprobación:
  Card h-full (flex flex-col):
    CardHeader: "Revisión y Aprobación" (text-lg font-medium) · "Editá el reporte antes de cerrar el echelon." (text-sm text-muted-foreground)
    CardContent (flex-1 flex flex-col gap-4):
      Barra de herramientas editor (igual que en Chat 7: Bold, Italic, H1-H3, listas, undo/redo):
        Badge derecha: "Guardado" (CheckCircle 12px, emerald)
      Área de editor (flex-1 min-h-[300px] border rounded-lg p-4 text-sm leading-relaxed):
        Mismo contenido que el panel izquierdo, pero en modo editable (simular cursor)
      "947 caracteres" (text-xs text-muted-foreground text-right)

      Separator

      div (flex flex-col gap-3):
        Button full-width size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white":
          CheckCircle (18px) + "Aprobar y Cerrar Echelon"
        "Esta acción es irreversible. El echelon pasará a estado CLOSED." (text-xs text-muted-foreground text-center)
        Button full-width variant="ghost" size="sm": "Guardar borrador sin cerrar"

DIALOG ABIERTO "Confirmar cierre":
  DialogHeader: "¿Cerrar el echelon definitivamente?"
  DialogDescription: "Esta acción es irreversible. El echelon Fase de Levantamiento de Requerimientos pasará a estado CLOSED. Todos los summaries validados quedarán bloqueados."
  DialogFooter: Button variant="outline" "Cancelar" · Button className="bg-emerald-600 hover:bg-emerald-700 text-white" "Sí, cerrar echelon" (con Lock 14px)

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 9 · Device Management · `/devices`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Tablas: componente Table de shadcn · encabezado sticky
  Confirmar revocar: Dialog variant="destructive"
  Feedback de éxito: Toast bottom-right
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground
  Código/mono: font-mono text-xs bg-muted px-1 rounded

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Dispositivos" (Monitor)
  - Breadcrumb: "Dispositivos"

---

CONTENIDO DE LA PANTALLA — Device Management:

PAGE HEADER (flex items-start justify-between mb-6):
  Izquierda:
    "Dispositivos" (text-2xl font-semibold tracking-tight)
    "Asistentes de IA registrados en la organización" (text-sm text-muted-foreground mt-1)
  Derecha: Button blue-500 (Plus 16px) "+ Enrolar dispositivo"

TABLA (Card rounded-xl border shadow-sm, CardContent p-0):
  Columnas (TableHead, text-xs uppercase tracking-wide text-muted-foreground):
    "Dispositivo" · "Usuario" · "Sistema operativo" · "Último contacto" · "Estado" · "" (acciones)

  3 filas ficticias:

  Fila 1 — "En línea":
    Dispositivo: "a3f8b2c1...d4e9" (font-mono text-xs truncate, max-w-[120px]) + "MacBook-Dario" (text-xs text-muted-foreground block)
    Usuario: Avatar (iniciales "DA", h-7 w-7, bg-blue-500/10 text-blue-500 text-xs) + "Dario Acme" (text-sm ml-2)
    Sistema: Apple (ícono o texto) + "macOS 14.2" (text-sm)
    Último contacto: "hace 2 min" (text-sm)
    Estado: Badge (emerald, variant outline) con dot pulsante (w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1) "En línea"
    Acciones: DropdownMenu (MoreHorizontal) → "Ver detalle" · separator · "Revocar acceso" (text-destructive)

  Fila 2 — "Inactivo":
    Dispositivo: "c7a1e5f0...b8d3" + "PC-Oficina-MR"
    Usuario: "MR" + "María Rodríguez"
    Sistema: "Windows 11 Pro"
    Último contacto: "hace 3 días"
    Estado: Badge (zinc-400, variant outline) "Inactivo"
    Acciones: igual

  Fila 3 — "Revocado":
    Dispositivo: "9f2d4a7e...c1b6" + "Laptop-JL"
    Usuario: "JL" + "Juan López"
    Sistema: "Ubuntu 22.04"
    Último contacto: "hace 12 días"
    Estado: Badge (destructive variant o red-500/10) "Revocado"
    Acciones: solo "Ver detalle" (revocar deshabilitado, ya revocado)

DIALOG ABIERTO "Enrolar nuevo dispositivo":
  DialogHeader: "Enrolar nuevo dispositivo" · "El dispositivo debe tener el asistente instalado para completar el proceso."
  DialogContent:
    Div centrado (flex flex-col items-center gap-4 py-4):
      Cuadrado 200x200 redondeado con borde dashed (border-2 border-dashed border-muted-foreground/30 rounded-xl):
        Dentro: QrCode (48px, text-muted-foreground/50) centrado + texto "QR code" (text-xs text-muted-foreground)
      "Escaneá este código con el asistente en el dispositivo de destino" (text-sm text-muted-foreground text-center max-w-[260px])
      div w-full:
        Label "Link de enrolamiento"
        Input value="backoffice://enroll?token=eyJhb..." readOnly className="font-mono text-xs"
        Button variant="outline" size="sm" full-width mt-2 (Copy 14px) "Copiar link"
      "⏱ Este link expira en 24 horas" (text-xs text-muted-foreground text-center mt-2)
  DialogFooter: Button variant="outline" "Cerrar"

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 10 · Budget Dashboard · `/budget`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Badges de estado (Badge variant="outline" + className):
  IN_PROGRESS:    "bg-blue-500/10 text-blue-500 border-blue-500/20"
  CLOSED:         "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  CLOSING:        "bg-amber-500/10 text-amber-600 border-amber-500/20"

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Progress: componente Progress de shadcn (h-3 para el de límite, h-1.5 para los mini en tabla)
  Charts Recharts: barras blue-500 (#3b82f6), líneas blue-500, área fill blue-500/10
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · número grande: text-3xl font-bold · muted: text-sm text-muted-foreground

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Presupuesto" (BarChart3)
  - Breadcrumb: "Presupuesto"

---

CONTENIDO DE LA PANTALLA — Budget Dashboard:

ALERT BANNER (mb-6, mostrar como visible — estado de alerta activo):
  div rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 flex items-center justify-between:
    Izquierda: AlertTriangle (18px, text-amber-500) + "Alerta: consumiste el 85% de tu límite mensual de tokens. Considerá revisar el consumo o aumentar el límite." (text-sm)
    Derecha: Button variant="ghost" size="sm" "Configurar límite" (Settings 14px)

PAGE HEADER:
  "Presupuesto de Tokens" (text-2xl font-semibold tracking-tight mb-6)

SECCIÓN 1 — 3 stat cards (grid grid-cols-3 gap-4 mb-6):
  Card 1: "Tokens — Febrero 2026"
    Número "1.245.320" (text-3xl font-bold, con separador de miles)
    "+12% vs. enero" (text-xs text-muted-foreground con TrendingUp 12px emerald)
    CardHeader ícono: Zap (blue-500)

  Card 2: "Costo estimado"
    "$124.53 USD" (text-3xl font-bold)
    "Proyección fin de mes: ~$180" (text-xs text-muted-foreground)
    CardHeader ícono: DollarSign

  Card 3: "% del límite mensual"
    "85%" (text-3xl font-bold text-amber-600)
    Progress value=85 className="h-3 mt-2 mb-2 [&>div]:bg-amber-500"
    "1.700.500 / 2.000.000 tokens" (text-xs text-muted-foreground)
    CardHeader ícono: Gauge

SECCIÓN 2 — 2 charts (grid grid-cols-2 gap-4 mb-6):
  Card izquierda "Tokens por mes — últimos 6 meses":
    BarChart Recharts height=220:
      Datos: Sep=980k, Oct=1150k, Nov=870k, Dic=1380k, Ene=1050k, Feb=1245k (valores en miles)
      fill="#3b82f6" · tooltip con número formateado · XAxis dataKey="mes"

  Card derecha "Costo diario — Febrero 2026":
    LineChart Recharts height=220 con AreaChart:
      Datos diarios ficticios para 26 días: valores entre $3 y $8 por día
      stroke="#3b82f6" fill="rgba(59,130,246,0.1)" · tooltip con "$X.XX USD"
      Línea horizontal dashed en $6 como "límite diario sugerido"

SECCIÓN 3 — Tabla de desglose (Card rounded-xl border shadow-sm):
  CardHeader: "Desglose por echelon" + Select "Febrero 2026" (pequeño, variant outline, a la derecha)
  CardContent p-0 — Table:
    Columnas: "Echelon" · "Producto" · "Tokens" · "Costo" · "% del total"
    4 filas ficticias:
      Fila con mayor uso (resaltar con className="bg-amber-500/5"):
        "Fase Levantamiento ERP" + Badge IN_PROGRESS · "ERP Implementation" · "487.320" (font-medium) · "$48.73" ·
        Progress mini (h-1.5, w-24, inline-block, [&>div]:bg-amber-500) al 39%

      "Arquitectura Microservicios" + Badge IN_PROGRESS · "API Gateway" · "312.180" · "$31.22" · Progress 25%
      "Revisión Performance" + Badge CLOSING · "ERP Implementation" · "289.450" · "$28.95" · Progress 23%
      "Onboarding HR" + Badge IN_PROGRESS · "HR Suite" · "156.550" · "$15.66" · Progress 13%

    TableFooter (bg-muted/30): "Total" (font-bold) · — · "1.245.500" (font-bold) · "$124.56 USD" (font-bold) · 100%

Exportar como componente React TypeScript. Recharts ya instalado. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 11 · Audit Log Viewer · `/audit`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Badges de acción (Badge variant="outline" + className):
  CREATE:     "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  UPDATE:     "bg-blue-500/10 text-blue-500 border-blue-500/20"
  DELETE:     "bg-red-500/10 text-red-500 border-red-500/20"
  TRANSITION: "bg-violet-500/10 text-violet-500 border-violet-500/20"
  LOGIN:      "bg-zinc-400/10 text-zinc-400 border-zinc-400/20"

Badges de rol (Badge variant="outline" + className):
  SUPER_ADMIN: "bg-red-500/10 text-red-500"  ·  ADMIN: "bg-orange-500/10 text-orange-500"
  MANAGER:     "bg-blue-500/10 text-blue-500" ·  MEMBER: "bg-zinc-500/10 text-zinc-500"

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Código/mono: font-mono text-xs bg-muted px-1.5 py-0.5 rounded
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Auditoría" (ClipboardList)
  - Breadcrumb: "Registro de Auditoría"

---

CONTENIDO DE LA PANTALLA — Audit Log Viewer:

PAGE HEADER (flex items-center justify-between mb-6):
  "Registro de Auditoría" (text-2xl font-semibold tracking-tight)
  Button variant="outline" size="sm" (Download 14px) "Exportar CSV"

BARRA DE FILTROS (flex flex-wrap items-center gap-3 mb-4, Card rounded-xl border p-4):
  Input placeholder="Buscar actor..." className="w-[180px]" (Search 14px, icon izquierda)
  Select placeholder="Tipo de acción" className="w-[160px]":
    Opciones: "Todas", "CREATE", "UPDATE", "DELETE", "TRANSITION", "LOGIN"
  Select placeholder="Entidad" className="w-[140px]":
    Opciones: "Todas", "Echelon", "Summary", "Session", "Company", "User", "Device"
  Button variant="outline" size="sm" (Calendar 14px) "Rango de fechas"
  Button variant="ghost" size="sm" (X 14px, text-muted-foreground) "Limpiar filtros"

TABLA (Card rounded-xl border shadow-sm, CardContent p-0):
  Columnas (TableHead text-xs uppercase tracking-wide text-muted-foreground):
    "Fecha y hora" · "Actor" · "Acción" · "Entidad" · "IP" · "" (expandir)

  5 filas ficticias + 1 expandida:

  Fila 1 (normal):
    "26 Feb 2026 · 14:32:05" (font-mono text-xs)
    Avatar "DA" (blue-500/10) + "dario@empresa.com" (text-sm) + Badge SUPER_ADMIN (text-xs ml-2)
    Badge TRANSITION (violet)
    "Echelon" (font-medium text-sm) + " #a1b2c3d4" (font-mono text-xs text-muted-foreground)
    "190.210.25.111" (font-mono text-xs)
    Button variant="ghost" size="icon" (ChevronDown 14px)

  Fila 2 — EXPANDIDA (mostrar como si ya se clickeó el expand):
    Mismas columnas que fila 1 · Badge UPDATE (blue) · "Summary #e5f6g7h8"
    En la fila expandida debajo (TableRow de expansión, bg-muted/20):
      td colSpan=6 padding p-4:
        div grid grid-cols-2 gap-4:
          Card "Antes" (border-red-500/20 bg-red-500/5):
            CardHeader: "Antes" (text-xs font-medium text-red-500 uppercase)
            CardContent: pre font-mono text-xs leading-relaxed:
              {
                "status": "DRAFT",
                "editedContent": null
              }
          Card "Después" (border-emerald-500/20 bg-emerald-500/5):
            CardHeader: "Después" (text-xs font-medium text-emerald-500 uppercase)
            CardContent: pre:
              {
                "status": "REVIEW",
                "editedContent": "Se relevaron los..."
              }

  Fila 3: "26 Feb 2026 · 13:15:22" · "jl@empresa.com" + Badge MANAGER · Badge CREATE (emerald) · "Session #c3d4e5f6" · "192.168.1.45"
  Fila 4: "26 Feb 2026 · 11:08:44" · "da@empresa.com" + SUPER_ADMIN · Badge DELETE (red) · "Company #d4e5f6g7" · "190.210.25.111"
  Fila 5: "25 Feb 2026 · 09:30:01" · "mr@empresa.com" + ADMIN · Badge LOGIN (zinc) · "User #mr-uuid" · "172.20.10.5"

PIE DE TABLA (flex items-center justify-between mt-4 px-1):
  "Mostrando 1-20 de 347 entradas" (text-sm text-muted-foreground)
  Paginación: Button variant="outline" size="sm" disabled "← Anterior" · "1" (font-medium) · Button "Siguiente →"

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 12 · Settings / Profile · `/settings`

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500

Convenciones:
  Cards: rounded-xl shadow-sm border · CardHeader + CardContent
  Formularios: labels arriba de los inputs · mensajes de validación debajo
  Switch: componente Switch de shadcn para toggles
  Dialog: para mostrar API key recién generada
  Toast bottom-right para guardado exitoso
  Todo el texto en español (Argentina)
  Tipografía — título: text-2xl font-semibold tracking-tight · muted: text-sm text-muted-foreground
  Código/mono: font-mono text-xs bg-muted px-1 rounded

LAYOUT SHELL (misma estructura del Chat 2, con estas diferencias):
  - Ítem de nav activo: "Configuración" (Settings)
  - Breadcrumb: "Configuración"

---

CONTENIDO DE LA PANTALLA — Settings / Profile:

PAGE HEADER:
  "Configuración" (text-2xl font-semibold tracking-tight mb-6)

TABS (TabsList con 4 tabs):
  "Perfil" ← activo · "Organización" · "API Keys" · "Notificaciones"

TAB PERFIL (activo):
  Card max-w-2xl:
    CardHeader: "Perfil personal" · "Actualizá tu información personal y preferencias."
    CardContent (flex flex-col gap-6):
      Sección avatar (flex items-center gap-6):
        Div relativo: Avatar grande (h-20 w-20) con iniciales "DA" (text-2xl, bg-blue-500/10 text-blue-500) · Button absoluto bottom-0 right-0 (h-7 w-7, rounded-full, Camera 14px) "Cambiar"
        div: "Dario Acme" (text-base font-medium) · "SUPER_ADMIN" (Badge bg-red-500/10 text-red-500 text-xs) · "Foto de perfil: JPG o PNG, máx. 2 MB" (text-xs text-muted-foreground)
      Separator
      grid grid-cols-2 gap-4:
        Campo "Nombre completo": Input value="Dario Acme"
        Campo "Correo electrónico": Input value="dario@empresa.com" readOnly con Lock (14px, muted) icono derecha · "El correo se gestiona desde Supabase Auth." (text-xs muted debajo)
        Campo "Idioma preferido": Select (globe icon izquierda) — "🇦🇷 Español (Argentina)" seleccionado · "🇺🇸 English"
        Campo "Zona horaria": Select — "America/Argentina/Buenos_Aires" · otras opciones
    CardFooter: Button blue-500 "Guardar cambios"

TAB ORGANIZACIÓN (mostrar también en el diseño):
  Card max-w-2xl:
    CardHeader: "Organización" · "Información y configuración del espacio de trabajo."
    CardContent grid grid-cols-2 gap-4:
      Campo "Nombre de la organización": Input value="Acme Consulting"
      Campo "Slug": Input value="acme-consulting" readOnly · Lock icon · "El slug no puede cambiarse." (text-xs muted)
      Campo "Plan": Select deshabilitado value="Professional" · "Contactá soporte para cambiar de plan." (text-xs muted)
    CardFooter: Button blue-500 "Guardar"

TAB API KEYS (mostrar también):
  Card:
    CardHeader (flex justify-between): "API Keys" + Button blue-500 size="sm" (Plus 14px) "+ Nueva API key"
    CardContent p-0:
      Table:
        Columnas: "Nombre" · "Key" · "Creada" · "Último uso" · "Revocar"
        3 filas:
          "Producción" · "sk-prod-●●●●●●●●4f2a" (font-mono text-xs) · "15 Ene 2026" · "hace 2 min" · Button ghost size="sm" text-destructive "Revocar"
          "Staging" · "sk-stg-●●●●●●●●b8c3" · "20 Ene 2026" · "hace 3 días" · "Revocar"
          "Local Dev" · "sk-dev-●●●●●●●●e7d1" · "5 Feb 2026" · "hace 1 sem." · "Revocar"

  DIALOG ABIERTO "API key creada" (mostrar sobre la tabla):
    DialogHeader: "API key generada" · "Copiá esta key ahora. No podrás verla de nuevo."
    DialogContent:
      Alert (amber, AlertTriangle): "Una vez cerres este diálogo, la key no se mostrará de nuevo."
      Label "Tu nueva API key:"
      div flex gap-2:
        Input value="sk-prod-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" readOnly className="font-mono text-xs flex-1"
        Button variant="outline" size="sm" (Copy 14px) "Copiar"
    DialogFooter: Button blue-500 "Entendido, ya la copié"

TAB NOTIFICACIONES (mostrar también):
  Card max-w-2xl:
    CardHeader: "Notificaciones" · "Configurá qué alertas querés recibir."
    CardContent (flex flex-col divide-y):
      4 ítems, cada uno flex items-start justify-between py-4:
        div: label (text-sm font-medium) + descripción (text-xs text-muted-foreground mt-1)
        Switch (checked o unchecked)
      Ítems:
        "Alertas de presupuesto" + "Notificarte cuando el uso supere el 80% del límite mensual." · Switch checked
        "Nuevos summaries para revisar" + "Cuando un summary pase a estado REVIEW." · Switch checked
        "Cambios de estado de echelon" + "Transiciones de estado en los echelons que seguís." · Switch unchecked
        "Invitaciones de equipo" + "Cuando un administrador te invite a un nuevo proyecto." · Switch checked
    CardFooter: Button blue-500 "Guardar preferencias"

Exportar como componente React TypeScript. Datos ficticios hardcodeados. Sin llamadas a API.
```

---

## Chat 13 · Register (invitación) · `/register`

> Pantalla de auth. Sin sidebar ni header. Similar al Login pero para completar el registro con token de invitación.

```
Librería de componentes: shadcn/ui · estilo: new-york · color base: zinc
Framework: Next.js 15 App Router · TypeScript strict
Fuente: Geist Sans (className="font-sans")
Dark mode: class strategy — renderizar en modo oscuro por defecto
Solo Tailwind CSS — sin estilos inline, sin colores hex/oklch hardcodeados en JSX
Radio de bordes: lg=0.5rem · md=0.375rem · sm=0.25rem
Color de acción primaria: blue-500
Convenciones: Cards rounded-xl shadow-sm border · Alert variant="destructive" para errores · todo el texto en español (Argentina)

---

Diseñá la pantalla de registro por invitación para un backoffice SaaS empresarial.
Sin sidebar. Sin header. Div full-viewport (min-h-screen) centrado vertical y horizontalmente.

FONDO: igual al Login — dark con patrón sutil de puntos en zinc-800/20.

CONTENIDO CENTRADO (max-w-[400px] w-full mx-auto px-4, flex flex-col items-center gap-6):

1. Encabezado sobre el card (igual al Login):
   - Ícono LayoutDashboard (blue-500, 28px) con fondo blue-500/10 rounded-xl
   - "Project Planning Backoffice" (text-xl font-semibold, text-center)
   - "Área de administración" (text-sm text-muted-foreground, text-center)

2. Card (w-full rounded-xl border shadow-sm p-6 flex flex-col gap-4):
   Badge sobre el título (Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 mb-2 self-start"):
     CheckCircle (14px) + "Invitado por Acme Consulting"

   Título: "Completá tu registro" (text-xl font-semibold)
   Subtítulo: "Tu cuenta fue pre-creada por un administrador. Solo falta que establezcas tu contraseña." (text-sm text-muted-foreground)

   Alert variant="destructive" con AlertCircle: "Este enlace de invitación no es válido o ya expiró. Contactá a tu administrador para recibir uno nuevo." (mostrar como visible)

   Campo "Correo electrónico":
     Label "Correo electrónico" + texto "(read-only)" (text-xs text-muted-foreground inline ml-2)
     Input type=email value="nuevo.usuario@empresa.com" readOnly className="bg-muted cursor-not-allowed"
     Lock (14px, text-muted-foreground) icono derecha

   Campo "Nombre completo *":
     Input placeholder="Ej: María García" autofocus

   Campo "Contraseña *":
     Input type=password placeholder="Mínimo 8 caracteres" con Eye/EyeOff toggle
     Indicador de fuerza debajo (3 segmentos, 2 rellenos en amber — contraseña media): "Contraseña media" (text-xs text-amber-500)

   Campo "Confirmar contraseña *":
     Input type=password placeholder="Repetí tu contraseña"
     Mensaje de validación (si no coinciden): "Las contraseñas no coinciden." (text-xs text-destructive)

   Botón primario full-width "Crear mi cuenta" (blue-500); estado loading: Loader2 (animate-spin) + "Creando cuenta..."

3. Debajo del card:
   "¿Problemas con tu invitación?" (text-sm text-muted-foreground) + Link "Contactar soporte" (text-blue-500)

Exportar como componente React TypeScript. Sin llamadas a API — estado local con useState.
```

---

_Documento v2.0 — generado el 2026-02-26. Para integración con API routes y estado real, ver `ROADMAP.md §9`._
