# Análisis Funcional — Project-Planning-Backoffice

> **Versión:** 1.0.0 | **Fecha:** 2026-03-04 | **Autor:** Relevamiento técnico automático
> **Scope:** Estado real del sistema al día de hoy, segmentado por roles.
> Fuente de verdad: código fuente auditado — routes, middlewares, schemas, módulos de dominio.

---

## 1. Modelo de Roles (RBAC)

### 1.1 Jerarquía

```
SUPER_ADMIN (4) > ADMIN (3) > MANAGER (2) > MEMBER (1) > VIEWER (0)
```

El guard `withRole('X')` permite acceso a usuarios con rol ≥ X en la jerarquía.
Implementado en: `src/lib/middleware/with-role.ts`

### 1.2 Descripción de cada rol

| Rol             | Descripción funcional                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SUPER_ADMIN** | Control total del sistema. Puede hacer todo lo que ADMIN puede, más acciones reservadas de plataforma.                                                                                       |
| **ADMIN**       | Administrador de organización. Gestiona miembros, puede eliminar recursos, modifica empresas.                                                                                                |
| **MANAGER**     | Gestor operativo. Crea y opera echelons, dispara FSM, lanza el Assistant.                                                                                                                    |
| **MEMBER**      | Usuario estándar. Puede crear sesiones, enviar summaries, enrolar dispositivos, leer todo.                                                                                                   |
| **VIEWER**      | Solo lectura. No puede crear ni modificar nada. _(Rol definido en jerarquía, pero actualmente sin restricciones específicas que lo diferencien de MEMBER en muchos endpoints — ver §6 Gaps)_ |

### 1.3 Flujo de autenticación

```
1. POST /api/v1/auth/login  →  { accessToken, user }
2. Todas las requests autenticadas llevan:
   - Header: Authorization: Bearer <accessToken>
   - Header: X-Organization-Id: <organizationId>
3. El middleware withAuth verifica el JWT (Supabase) → inyecta userId
4. El middleware withTenant verifica membresía → inyecta organizationId + role
5. El middleware withRole(minRole) verifica la jerarquía → 403 si insuficiente
```

**El Assistant** (Electron) usa el mismo mecanismo Bearer, con un token obtenido
previamente via `GET /api/v1/auth/devices/[machineId]` (ver §5).

---

## 2. Matriz de Permisos por Endpoint

Leyenda: ✅ Permitido | ❌ Bloqueado (403) | ⚠️ Sin restricción (gap)

### 2.1 Autenticación y Organización

| Endpoint                                      | Método | Anon | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                  |
| --------------------------------------------- | ------ | ---- | ------ | ------ | ------- | ----- | ----------- | ---------------------- |
| `/api/v1/auth/login`                          | POST   | ✅   | ✅     | ✅     | ✅      | ✅    | ✅          | Público                |
| `/api/v1/auth/register`                       | POST   | ✅   | ✅     | ✅     | ✅      | ✅    | ✅          | Público                |
| `/api/v1/auth/me`                             | GET    | ❌   | ✅     | ✅     | ✅      | ✅    | ✅          | Solo auth, sin tenant  |
| `/api/v1/auth/onboarding/create-organization` | POST   | ❌   | ✅     | ✅     | ✅      | ✅    | ✅          | Primer org del usuario |
| `/api/v1/health`                              | GET    | ✅   | ✅     | ✅     | ✅      | ✅    | ✅          | Público                |

### 2.2 Miembros de Organización

| Endpoint                                    | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas             |
| ------------------------------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | ----------------- |
| `/api/v1/organizations/:id/members`         | GET    | ✅     | ✅     | ✅      | ✅    | ✅          | Cualquier miembro |
| `/api/v1/organizations/:id/members`         | POST   | ❌     | ❌     | ❌      | ✅    | ✅          | Invitar miembro   |
| `/api/v1/organizations/:id/members/:userId` | PATCH  | ❌     | ❌     | ❌      | ✅    | ✅          | Cambiar rol       |
| `/api/v1/organizations/:id/members/:userId` | DELETE | ❌     | ❌     | ❌      | ✅    | ✅          | Quitar miembro    |

### 2.3 Empresas (Companies)

| Endpoint                | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                 |
| ----------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | --------------------- |
| `/api/v1/companies`     | GET    | ✅     | ✅     | ✅      | ✅    | ✅          | Paginado, searchable  |
| `/api/v1/companies`     | POST   | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole** |
| `/api/v1/companies/:id` | GET    | ✅     | ✅     | ✅      | ✅    | ✅          |                       |
| `/api/v1/companies/:id` | PATCH  | ❌     | ❌     | ❌      | ✅    | ✅          | Requiere `version`    |
| `/api/v1/companies/:id` | DELETE | ❌     | ❌     | ❌      | ✅    | ✅          | Requiere `?version=N` |

### 2.4 Productos

| Endpoint               | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                      |
| ---------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | -------------------------- |
| `/api/v1/products`     | GET    | ✅     | ✅     | ✅      | ✅    | ✅          | Filtrable por `?companyId` |
| `/api/v1/products`     | POST   | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole**      |
| `/api/v1/products/:id` | GET    | ✅     | ✅     | ✅      | ✅    | ✅          |                            |
| `/api/v1/products/:id` | PATCH  | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole**      |
| `/api/v1/products/:id` | DELETE | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole**      |

### 2.5 Echelons

| Endpoint                           | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                                |
| ---------------------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | ------------------------------------ |
| `/api/v1/echelons`                 | GET    | ✅     | ✅     | ✅      | ✅    | ✅          | Filtrable por `?productId`, `?state` |
| `/api/v1/echelons`                 | POST   | ❌     | ❌     | ✅      | ✅    | ✅          | `withRole('MANAGER')`                |
| `/api/v1/echelons/:id`             | GET    | ✅     | ✅     | ✅      | ✅    | ✅          |                                      |
| `/api/v1/echelons/:id`             | PATCH  | ❌     | ❌     | ✅      | ✅    | ✅          | Requiere `version`                   |
| `/api/v1/echelons/:id`             | DELETE | ❌     | ❌     | ❌      | ✅    | ✅          | Requiere `?version=N`                |
| `/api/v1/echelons/:id/transition`  | PATCH  | ❌     | ❌     | ✅      | ✅    | ✅          | FSM — body: `{ event, version }`     |
| `/api/v1/echelons/:id/consolidate` | POST   | ❌     | ❌     | ✅      | ✅    | ✅          | IA + body: `{ version }`             |
| `/api/v1/echelons/:id/close`       | POST   | ❌     | ❌     | ✅      | ✅    | ✅          | Integration + body: `{ version }`    |
| `/api/v1/echelons/:id/launch`      | POST   | ❌     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: debería ser MANAGER+**        |

### 2.6 Campos Obligatorios del Echelon (Required Fields)

| Endpoint                               | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                 |
| -------------------------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | --------------------- |
| `/api/v1/echelons/:id/required-fields` | GET    | ✅     | ✅     | ✅      | ✅    | ✅          |                       |
| `/api/v1/echelons/:id/required-fields` | POST   | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole** |
| `/api/v1/required-fields/:id`          | PATCH  | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole** |
| `/api/v1/required-fields/:id`          | DELETE | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole** |

### 2.7 Sesiones

| Endpoint                        | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                 |
| ------------------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | --------------------- |
| `/api/v1/echelons/:id/sessions` | GET    | ✅     | ✅     | ✅      | ✅    | ✅          |                       |
| `/api/v1/echelons/:id/sessions` | POST   | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole** |
| `/api/v1/sessions/:id`          | GET    | ✅     | ✅     | ✅      | ✅    | ✅          |                       |
| `/api/v1/sessions/:id`          | PATCH  | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole** |
| `/api/v1/sessions/:id`          | DELETE | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | **GAP: sin withRole** |

### 2.8 Executive Summaries

| Endpoint                       | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                                                                      |
| ------------------------------ | ------ | ------ | ------ | ------- | ----- | ----------- | -------------------------------------------------------------------------- |
| `/api/v1/sessions/:id/summary` | GET    | ✅     | ✅     | ✅      | ✅    | ✅          |                                                                            |
| `/api/v1/sessions/:id/summary` | POST   | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | Idempotente. Requiere `Idempotency-Key`. Auto-transiciona OPEN→IN_PROGRESS |
| `/api/v1/sessions/:id/summary` | PATCH  | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | FSM: DRAFT→REVIEW→EDITED→VALIDATED                                         |

### 2.9 Dispositivos

| Endpoint                          | Método | Anon | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                                                  |
| --------------------------------- | ------ | ---- | ------ | ------ | ------- | ----- | ----------- | ------------------------------------------------------ |
| `/api/v1/auth/devices`            | POST   | ❌   | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | Idempotente. Enroll Assistant device                   |
| `/api/v1/auth/devices/:machineId` | GET    | ✅   | ✅     | ✅     | ✅      | ✅    | ✅          | **Sin auth** — Rate limit 10/5min. Retorna accessToken |
| `/api/v1/auth/devices/:machineId` | DELETE | ❌   | ❌     | ❌     | ❌      | ✅    | ✅          | Revocar dispositivo                                    |
| `/api/v1/devices`                 | GET    | ❌   | ✅     | ✅     | ✅      | ✅    | ✅          | Lista dispositivos de la org                           |

### 2.10 Budget / Uso

| Endpoint              | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                                                               |
| --------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | ------------------------------------------------------------------- |
| `/api/v1/usage`       | GET    | ✅     | ✅     | ✅      | ✅    | ✅          | `?monthYear=YYYY-MM`                                                |
| `/api/v1/usage`       | POST   | ⚠️     | ⚠️     | ⚠️      | ⚠️    | ⚠️          | Idempotente. Registra tokens LLM. Dispara alerta si ≥80% del límite |
| `/api/v1/usage/limit` | GET    | ✅     | ✅     | ✅      | ✅    | ✅          | Límite mensual configurado                                          |

### 2.11 Context Bundle (para el Assistant)

| Endpoint                     | Método | VIEWER | MEMBER | MANAGER | ADMIN | SUPER_ADMIN | Notas                                                                                                 |
| ---------------------------- | ------ | ------ | ------ | ------- | ----- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `/api/v1/context/:echelonId` | GET    | ✅     | ✅     | ✅      | ✅    | ✅          | Rate limit: 10 req/5min. Cacheado en KV. `?queryEmbedding=<base64url>` para pgvector ranked retrieval |

### 2.12 Otros

| Endpoint                     | Método | Min Rol | Notas                                                               |
| ---------------------------- | ------ | ------- | ------------------------------------------------------------------- |
| `/api/v1/audit`              | GET    | MEMBER  | **GAP: debería ser ADMIN+**. Filtrable por `entityType`, `entityId` |
| `/api/v1/notifications`      | GET    | MEMBER  | Notificaciones pendientes de la org                                 |
| `/api/v1/attachments`        | GET    | MEMBER  | Adjuntos por echelon                                                |
| `/api/v1/attachments`        | POST   | MEMBER  | Subir adjunto                                                       |
| `/api/v1/attachments/:id`    | DELETE | MEMBER  | **GAP: sin withRole**                                               |
| `/api/v1/decision-links/:id` | PATCH  | MEMBER  | **GAP: sin withRole**                                               |
| `/api/v1/decision-links/:id` | DELETE | MEMBER  | **GAP: sin withRole**                                               |

---

## 3. Campos Obligatorios por Entidad

### 3.1 Organización

**Onboarding (primer uso):**

```json
POST /api/v1/auth/onboarding/create-organization
{
  "name": "string (2-120 chars)"  // REQUERIDO
  // slug derivado automáticamente del name
}
```

**Creación directa (backoffice):**

```json
POST /api/v1/organizations
{
  "name": "string (2-120 chars)",  // REQUERIDO
  "slug": "string (2-60, /^[a-z0-9-]+$/)"  // REQUERIDO
}
```

**Actualización:**

```json
PATCH /api/v1/organizations/:id
{
  "name": "string (2-120 chars)",  // REQUERIDO
  "version": number  // REQUERIDO (optimistic locking)
}
```

### 3.2 Empresa (Company)

```json
POST /api/v1/companies
{
  "name": "string (1-200 chars)",  // REQUERIDO
  "description": "string (max 1000)",  // opcional
  "industry": "string (max 100)",  // opcional
  "website": "URL válida"  // opcional
}
```

**Actualización parcial:**

```json
PATCH /api/v1/companies/:id
{
  // Al menos un campo de name/description/industry/website
  "version": number  // REQUERIDO
}
```

**Eliminación:**

```
DELETE /api/v1/companies/:id?version=N  // version en query param, REQUERIDO
```

### 3.3 Producto

```json
POST /api/v1/products
{
  "companyId": "UUID",  // REQUERIDO
  "name": "string (1-200 chars)",  // REQUERIDO
  "description": "string (max 1000)"  // opcional
}
```

### 3.4 Echelon

```json
POST /api/v1/echelons
{
  "productId": "UUID",  // REQUERIDO
  "name": "string (2-200 chars)",  // REQUERIDO
  "configBlueprint": { }  // opcional — configuración del tipo de eslabón
}
```

**Transición FSM:**

```json
PATCH /api/v1/echelons/:id/transition
{
  "event": "START_SESSION|CONSOLIDATE|CONSOLIDATION_COMPLETE|CLOSE|REJECT",  // REQUERIDO
  "version": number  // REQUERIDO
}
```

**Consolidar (trigger IA):**

```json
POST /api/v1/echelons/:id/consolidate
{
  "version": number  // REQUERIDO
}
```

**Cerrar:**

```json
POST /api/v1/echelons/:id/close
{
  "version": number  // REQUERIDO
}
```

### 3.5 Campo Obligatorio del Echelon (RequiredField)

```json
POST /api/v1/echelons/:id/required-fields
{
  "label": "string (2-200 chars)",  // REQUERIDO
  "description": "string (max 1000)",  // opcional
  "sortOrder": number  // opcional, default 0
}
```

**Marcar como cumplido:**

```json
PATCH /api/v1/required-fields/:id
{
  "isMet": true,  // al menos un campo de label/description/isMet/sortOrder
  "version": number  // REQUERIDO
}
```

### 3.6 Sesión

```json
POST /api/v1/echelons/:id/sessions
{
  "conductedAt": "ISO8601 datetime",  // opcional — fecha de la sesión
  "notes": "string (max 2000)"  // opcional
}
// El cuerpo puede ser {} — todos los campos son opcionales
```

### 3.7 Executive Summary (enviado por el Assistant)

```json
POST /api/v1/sessions/:id/summary
Headers:
  Idempotency-Key: <UUID>  // REQUERIDO para idempotencia
  Authorization: Bearer <token>
  X-Organization-Id: <UUID>

Body:
{
  "rawContent": "string",  // REQUERIDO — texto del resumen
  "embedding": [number, ...]  // opcional — vector 768 dims para pgvector
}
```

**Transición FSM del summary (backoffice):**

```json
PATCH /api/v1/sessions/:id/summary
{
  "event": "SUBMIT|APPROVE|EDIT|VALIDATE",  // REQUERIDO
  "editedContent": "string",  // requerido si event = EDIT
  "version": number  // REQUERIDO
}
```

### 3.8 Enrolamiento de Dispositivo (Assistant)

```json
POST /api/v1/auth/devices
Headers:
  Idempotency-Key: <UUID>  // REQUERIDO
  Authorization: Bearer <token>
  X-Organization-Id: <UUID>

Body:
{
  "machineId": "string (1-255 chars)",  // REQUERIDO — ID único de la máquina
  "userId": "UUID",  // REQUERIDO
  "osInfo": { }  // opcional — info del SO
}
```

### 3.9 Registro de Uso LLM

```json
POST /api/v1/usage
Headers:
  Idempotency-Key: <UUID>  // REQUERIDO

Body:
{
  "monthYear": "YYYY-MM",  // REQUERIDO
  "tokens": number,  // REQUERIDO — tokens consumidos
  "model": "string",  // REQUERIDO — modelo LLM usado
  "echelonId": "UUID"  // opcional
}
```

### 3.10 Invitar Miembro

```json
POST /api/v1/organizations/:id/members
{
  "email": "email válido",  // REQUERIDO
  "role": "VIEWER|MEMBER|MANAGER|ADMIN|SUPER_ADMIN"  // opcional, default MEMBER
}
```

---

## 4. Flujos por Rol

### 4.1 SUPER_ADMIN / ADMIN

**Puede todo lo que MANAGER puede, más:**

#### Flujo: Gestión de Miembros de la Organización

```
1. GET  /api/v1/organizations/:id/members  → Ver lista de miembros + roles
2. POST /api/v1/organizations/:id/members  → Invitar nuevo miembro (body: { email, role })
3. PATCH /api/v1/organizations/:id/members/:userId  → Cambiar rol (body: { role })
4. DELETE /api/v1/organizations/:id/members/:userId  → Quitar miembro
```

**Impacto DB:** `organization_members` — INSERT / UPDATE role / soft DELETE
**Efecto secundario:** Invalida cache de tenant-membership para el usuario afectado

#### Flujo: Eliminar recursos

```
DELETE /api/v1/companies/:id?version=N   → Soft-delete empresa
DELETE /api/v1/echelons/:id?version=N    → Soft-delete echelon
DELETE /api/v1/auth/devices/:machineId   → Revoca dispositivo (sets revokedAt)
```

**Impacto DB:** Setea `deleted_at` en la tabla correspondiente. Incrementa `version`.
**Notas:** El version en delete de echelon y company va como query param, no en body.

#### Flujo: Modificar empresa

```
1. GET  /api/v1/companies/:id  → Obtener empresa actual (incluye version)
2. PATCH /api/v1/companies/:id  → Actualizar (body: campos a cambiar + version)
```

---

### 4.2 MANAGER (+ hereda todo de MEMBER)

**Operaciones exclusivas del MANAGER:**

#### Flujo: Crear Echelon

```
1. GET  /api/v1/products/:id  → Verificar producto existente
2. POST /api/v1/echelons  → Crear echelon
   body: { productId, name, configBlueprint? }
3. POST /api/v1/echelons/:id/required-fields  → Agregar campos obligatorios (N veces)
   body: { label, description?, sortOrder? }
```

**Impacto DB:** INSERT en `echelons` (state=OPEN, version=1). INSERT en `required_fields`.
**Registro de auditoría:** `audit_logs` registra creación de Echelon y cada RequiredField.

#### Flujo: Ciclo de vida del Echelon (FSM)

```
Estado inicial: OPEN

[OPEN → IN_PROGRESS]
PATCH /api/v1/echelons/:id/transition
body: { event: "START_SESSION", version: N }
(también se dispara automáticamente al recibir el primer summary del Assistant)

[IN_PROGRESS → CLOSING → CLOSURE_REVIEW]
POST /api/v1/echelons/:id/consolidate
body: { version: N }
→ Internamente: transiciona a CLOSING, ejecuta IA (gpt-4o-mini),
  genera consolidatedReport, transiciona a CLOSURE_REVIEW.

[CLOSURE_REVIEW → IN_PROGRESS (rechazo)]
PATCH /api/v1/echelons/:id/transition
body: { event: "REJECT", version: N }

[CLOSURE_REVIEW → CLOSED]
POST /api/v1/echelons/:id/close
body: { version: N }
→ Internamente: transiciona a CLOSED, ejecuta Integration Engine
  (genera PDF job + email job según configBlueprint.type).
```

**Impacto DB:** UPDATE `echelons.state` + `echelons.version`. INSERT en `audit_logs`.
**Efecto secundario de consolidate:** INSERT en `usage_records` con tokens consumidos.
**Efecto secundario de close:** INSERT en `jobs` (GENERATE_PDF, SEND_EMAIL).

#### Flujo: Lanzar el Assistant

```
1. POST /api/v1/echelons/:id/launch
   → Retorna: { echelonId, deepLinkUrl, context: { requiredFields, sessions, summaries, ... } }
2. El deepLinkUrl tiene formato: <APP_URL>/echelon/:id?contextVersion=N
3. El backoffice admin copia/abre el deep-link → el Electron abre con ese contexto
```

**Impacto DB:** Solo lectura (construye el contexto bundle).
**Nota actual:** Este endpoint no tiene `withRole` — cualquier miembro puede llamarlo.
Debería ser `MANAGER+` (gap identificado).

#### Flujo: Modificar campos del Echelon

```
PATCH /api/v1/echelons/:id
body: { name?, configBlueprint?, consolidatedReport?, version }

PATCH /api/v1/required-fields/:id
body: { label?, description?, isMet?, sortOrder?, version }
(marcar campo como cumplido cuando el Assistant completa la sesión correspondiente)
```

---

### 4.3 MEMBER

**El MEMBER es el rol de trabajo diario.** Puede crear sesiones, ver todo, y es el rol que usa el Assistant cuando actúa en nombre del usuario.

#### Flujo: Ver estado del sistema

```
GET /api/v1/companies         → Lista de empresas de la org
GET /api/v1/companies/:id     → Detalle de empresa
GET /api/v1/products          → Productos (filtrar por ?companyId=UUID)
GET /api/v1/echelons          → Echelons (filtrar por ?productId=UUID y/o ?state=OPEN)
GET /api/v1/echelons/:id      → Detalle del echelon + estado FSM
GET /api/v1/echelons/:id/sessions       → Sesiones del echelon
GET /api/v1/echelons/:id/required-fields → Campos obligatorios
GET /api/v1/sessions/:id/summary        → Summary de una sesión
GET /api/v1/devices                     → Dispositivos enrolados en la org
GET /api/v1/usage?monthYear=YYYY-MM     → Consumo de tokens del mes
GET /api/v1/notifications               → Notificaciones pendientes
GET /api/v1/audit                       → Audit log (gap: no debería estar disponible)
```

#### Flujo: Crear empresa y producto (sin restricción de rol — GAP)

```
1. POST /api/v1/companies  → Crear empresa
   body: { name (requerido), description?, industry?, website? }
2. POST /api/v1/products   → Crear producto
   body: { companyId (requerido), name (requerido), description? }
```

**Nota:** Actualmente cualquier MEMBER puede crear empresas y productos.
Esto es un gap de diseño — debería requerir MANAGER+.

#### Flujo: Crear sesión

```
1. GET  /api/v1/echelons/:id  → Verificar que esté en OPEN o IN_PROGRESS
2. POST /api/v1/echelons/:id/sessions
   body: { conductedAt?: ISO8601, notes?: string }
   → Retorna: { id, echelonId, conductedAt, notes, state, ... }
```

**Impacto DB:** INSERT en `sessions`.

#### Flujo: Enviar Summary (desde el Assistant — en nombre de MEMBER)

```
1. POST /api/v1/sessions/:id/summary
   Headers: { Idempotency-Key: UUID, Authorization: Bearer <token>, X-Organization-Id: UUID }
   body: { rawContent: "texto del resumen", embedding?: number[768] }
   → Retorna 201: { id, sessionId, rawContent, state: "DRAFT", ... }
   → Efecto secundario: si el echelon está OPEN → auto-transiciona a IN_PROGRESS
   → Invalida cache del context bundle del echelon
```

**Impacto DB:** INSERT en `executive_summaries` (state=DRAFT). UPDATE `echelons.state` si OPEN.

#### Flujo: Validar/Editar Summary (en backoffice)

```
FSM del Summary: DRAFT → REVIEW → EDITED → VALIDATED

PATCH /api/v1/sessions/:id/summary
body: { event: "SUBMIT", version: N }   → DRAFT → REVIEW
body: { event: "EDIT", editedContent: "...", version: N }  → REVIEW/DRAFT → EDITED
body: { event: "VALIDATE", version: N }  → EDITED/REVIEW → VALIDATED
```

**Efecto secundario de VALIDATED:** Invalida cache KV del context bundle → el Assistant
verá el nuevo summary en su próxima llamada a `/context/:echelonId`.

#### Flujo: Enrolar dispositivo (Assistant)

```
POST /api/v1/auth/devices
Headers: { Idempotency-Key: UUID }
body: { machineId: "string", userId: UUID, osInfo?: {} }
→ Retorna 201: { id, machineId, organizationId, enrolledAt, ... }
```

**Impacto DB:** INSERT en `devices` (idempotente — si ya existe con mismo machineId, retorna el existente).

#### Flujo: Registrar uso LLM

```
POST /api/v1/usage
Headers: { Idempotency-Key: UUID }
body: { monthYear: "YYYY-MM", tokens: number, model: "gpt-4o-mini", echelonId?: UUID }
→ Si total acumulado ≥ 80% del límite → encola job BUDGET_ALERT
```

**Impacto DB:** INSERT en `usage_records`. Posible INSERT en `jobs` (BUDGET_ALERT).

---

### 4.4 VIEWER

Actualmente el rol VIEWER no tiene restricciones adicionales respecto a MEMBER en la mayoría de los endpoints. Esto es un **gap de diseño** — en la práctica un VIEWER puede crear sesiones, enrolar dispositivos, enviar summaries, etc.

**Flujos permitidos en la intención del sistema (solo lectura):**

```
GET /api/v1/companies
GET /api/v1/products
GET /api/v1/echelons
GET /api/v1/echelons/:id
GET /api/v1/echelons/:id/sessions
GET /api/v1/echelons/:id/required-fields
GET /api/v1/sessions/:id/summary
GET /api/v1/usage
GET /api/v1/devices
GET /api/v1/notifications
```

**Lo que el VIEWER NO debería poder hacer (pero actualmente puede — gaps):**

- Crear sesiones, summaries, empresas, productos, campos obligatorios
- Enrolar dispositivos

---

## 5. Flujo de Integración Backoffice ↔ Assistant (Data Plane)

### 5.1 Flujo completo de integración

```
[BACKOFFICE — ADMIN/MANAGER]
1. Crea organización (onboarding)
2. Crea empresa → producto → echelon
3. Define RequiredFields del echelon
4. Enrolla el dispositivo donde correrá el Assistant:
   POST /api/v1/auth/devices → { machineId, userId, osInfo }

[ASSISTANT — en el dispositivo]
5. Valida el dispositivo (al iniciar):
   GET /api/v1/auth/devices/:machineId  (sin auth)
   → Recibe: { accessToken, expiresAt, organizationId, userId }

6. Lanza asistente desde backoffice (modal):
   POST /api/v1/echelons/:id/launch
   → Recibe: { deepLinkUrl, context: { requiredFields, sessions, ... } }
   → El deepLinkUrl abre el Assistant con el echelon y contexto pre-cargado

[ASSISTANT — procesa la sesión con el usuario]
7. Obtiene contexto completo:
   GET /api/v1/context/:echelonId
   ?queryEmbedding=<base64url(embedding)>  (opcional, para ranked retrieval)
   → Recibe: RequiredFields + summaries rankeados + decision anchors

8. Realiza la sesión de trabajo con el usuario
   (local, sin llamadas al backoffice durante la sesión)

9. Al terminar, envía el summary:
   POST /api/v1/sessions/:id/summary
   Headers: { Idempotency-Key: <UUID generado localmente> }
   body: { rawContent: "texto", embedding?: number[768] }
   → Si echelon estaba OPEN → auto-transiciona a IN_PROGRESS
   → Invalida cache del context bundle

10. Registra el uso LLM:
    POST /api/v1/usage
    Headers: { Idempotency-Key: <UUID> }
    body: { monthYear, tokens, model, echelonId }
    → Si ≥80% del límite → dispara alerta

[BACKOFFICE — ADMIN/MANAGER]
11. Ve el summary recibido en tiempo real (Supabase Realtime)
12. Revisa y valida el summary:
    PATCH /api/v1/sessions/:id/summary  → event: "VALIDATE"
    → Invalida cache KV → próximas llamadas al contexto incluyen este summary

13. Repite 6-12 para N sesiones hasta completar todos los RequiredFields

14. Consolida:
    POST /api/v1/echelons/:id/consolidate  { version }
    → IA genera reporte consolidado
    → Echelon pasa a CLOSURE_REVIEW

15. Revisa el reporte consolidado en la UI:
    GET /api/v1/echelons/:id  → { consolidatedReport, state: "CLOSURE_REVIEW" }

16. Aprueba (CLOSE) o rechaza (REJECT) el cierre:
    POST /api/v1/echelons/:id/close  { version }   → CLOSED + PDF + email
    PATCH /api/v1/echelons/:id/transition  { event: "REJECT", version }  → IN_PROGRESS
```

### 5.2 Autenticación del Assistant

```
GET /api/v1/auth/devices/:machineId
→ No requiere autenticación propia
→ Rate limit: 10 req/5min por machineId
→ Retorna: { accessToken, expiresAt, organizationId, userId }

El accessToken se usa como Bearer en todas las requests del Assistant.
El token es de corta vida — el Assistant debe renovarlo antes de que expire.
```

### 5.3 Idempotencia en el Assistant

Los siguientes endpoints son idempotentes para permitir reintentos seguros:

| Endpoint                     | Header requerido  | Comportamiento                                                   |
| ---------------------------- | ----------------- | ---------------------------------------------------------------- |
| `POST /auth/devices`         | `Idempotency-Key` | Si el machineId ya existe → retorna el mismo device              |
| `POST /sessions/:id/summary` | `Idempotency-Key` | Si key ya procesado → retorna respuesta original sin re-ejecutar |
| `POST /usage`                | `Idempotency-Key` | Si key ya procesado → retorna respuesta original sin re-ejecutar |

**Política de retry recomendada para el Assistant:**

- Backoff exponencial: 1s → 2s → 4s → 8s → max 30s
- Max 5 reintentos
- Mismo `Idempotency-Key` en cada retry
- Circuit breaker: 5 fallos consecutivos → pausa 60s

---

## 6. Gaps e Inconsistencias Identificadas

### 6.1 Gaps de RBAC (acceso demasiado permisivo)

| #   | Endpoint                                    | Comportamiento actual | Comportamiento esperado | Severidad |
| --- | ------------------------------------------- | --------------------- | ----------------------- | --------- |
| G1  | `POST /api/v1/companies`                    | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G2  | `POST /api/v1/products`                     | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G3  | `PATCH /api/v1/products/:id`                | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G4  | `DELETE /api/v1/products/:id`               | Cualquier miembro     | ADMIN+                  | 🟡 MEDIA  |
| G5  | `POST /api/v1/echelons/:id/required-fields` | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G6  | `PATCH /api/v1/required-fields/:id`         | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G7  | `DELETE /api/v1/required-fields/:id`        | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G8  | `POST /api/v1/echelons/:id/sessions`        | Cualquier miembro     | MEMBER+ (ok) o MANAGER+ | 🟢 BAJA   |
| G9  | `PATCH /api/v1/sessions/:id`                | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G10 | `DELETE /api/v1/sessions/:id`               | Cualquier miembro     | ADMIN+                  | 🟡 MEDIA  |
| G11 | `POST /api/v1/echelons/:id/launch`          | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G12 | `GET /api/v1/audit`                         | Cualquier miembro     | ADMIN+                  | 🔴 ALTA   |
| G13 | `DELETE /api/v1/attachments/:id`            | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |
| G14 | `PATCH/DELETE /api/v1/decision-links/:id`   | Cualquier miembro     | MANAGER+                | 🟡 MEDIA  |

### 6.2 Gaps de diferenciación VIEWER vs MEMBER

El rol VIEWER actualmente no difiere de MEMBER en ningún endpoint de escritura. Para que el VIEWER sea verdaderamente "solo lectura", los endpoints de creación y modificación deberían tener `withRole('MEMBER')` explícito.

### 6.3 Otros gaps

| #   | Descripción                                                                                                                                                                        | Severidad |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| O1  | `GET /api/v1/auth/devices/:machineId` no requiere autenticación — cualquiera con un machineId válido puede obtener un accessToken. Debería validar que el device no esté revocado. | 🔴 ALTA   |
| O2  | El audit log está disponible para cualquier miembro — expone historial de todas las operaciones                                                                                    | 🔴 ALTA   |
| O3  | No hay validación de que el `userId` en el body de `POST /auth/devices` coincida con el userId del token de auth                                                                   | 🟡 MEDIA  |
| O4  | `POST /api/v1/sessions/:id/summary` no valida que la sesión pertenezca al echelon del contexto                                                                                     | 🟡 MEDIA  |
| O5  | `GET /api/v1/auth/devices/:machineId` retorna accessToken sin verificar que el device esté activo (sin `revokedAt`) — sí lo verifica el service, pero convendría confirmarlo       | 🟢 BAJA   |

---

## 7. Impacto en Base de Datos por Operación

### 7.1 Tablas y sus operaciones

| Tabla                  | INSERT                                     | UPDATE                         | Soft-DELETE                                   | Notas                                               |
| ---------------------- | ------------------------------------------ | ------------------------------ | --------------------------------------------- | --------------------------------------------------- |
| `organizations`        | Onboarding                                 | PATCH org                      | —                                             | Nunca se borra                                      |
| `organization_members` | Invite                                     | PATCH role                     | DELETE member                                 | Cache invalidado en cambio de rol                   |
| `companies`            | POST /companies                            | PATCH /companies/:id           | DELETE /companies/:id                         | `version` + `deleted_at`                            |
| `products`             | POST /products                             | PATCH /products/:id            | DELETE /products/:id                          | `version` + `deleted_at`                            |
| `echelons`             | POST /echelons                             | Transiciones FSM, PATCH        | DELETE /echelons/:id                          | `state` + `version` + `consolidatedReport`          |
| `required_fields`      | POST /echelons/:id/required-fields         | PATCH /required-fields/:id     | DELETE /required-fields/:id                   | `isMet` + `version`                                 |
| `sessions`             | POST /echelons/:id/sessions                | PATCH /sessions/:id            | DELETE /sessions/:id                          | `conductedAt`, `notes`                              |
| `executive_summaries`  | POST /sessions/:id/summary                 | PATCH summary (FSM)            | —                                             | `state`, `rawContent`, `editedContent`, `embedding` |
| `devices`              | POST /auth/devices                         | GET validate (lastSeenAt)      | DELETE /auth/devices/:machineId → `revokedAt` | Idempotente por machineId                           |
| `usage_records`        | POST /usage                                | —                              | —                                             | Idempotente por Idempotency-Key                     |
| `jobs`                 | Al cerrar echelon (close), al alert budget | —                              | —                                             | `type`, `status`, `payload`                         |
| `idempotency_keys`     | Cada POST idempotente                      | UPDATE status completed/failed | —                                             | TTL 24h, cleanup via cron                           |
| `audit_logs`           | Toda operación con `withAudit`             | —                              | —                                             | Append-only, nunca se modifica                      |
| `attachments`          | POST /attachments                          | —                              | DELETE /attachments/:id                       | Archivo en Supabase Storage                         |
| `decision_links`       | POST /required-fields/:id/decision-links   | PATCH /decision-links/:id      | DELETE /decision-links/:id                    | Vincula summary con campo                           |

### 7.2 Acciones que generan múltiples escrituras (transacciones)

| Acción                                   | Escrituras en cascada                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `POST /sessions/:id/summary`             | INSERT executive_summaries + (si echelon OPEN) UPDATE echelons.state + DELETE kv cache                           |
| `POST /echelons/:id/consolidate`         | UPDATE echelons.state (→CLOSING) + INSERT usage_records + UPDATE echelons (→CLOSURE_REVIEW + consolidatedReport) |
| `POST /echelons/:id/close`               | UPDATE echelons.state (→CLOSED) + INSERT jobs(GENERATE_PDF) + INSERT jobs(SEND_EMAIL)                            |
| `PATCH /sessions/:id/summary` (VALIDATE) | UPDATE executive_summaries.state + DELETE kv cache                                                               |
| `POST /usage` (≥80%)                     | INSERT usage_records + INSERT jobs(BUDGET_ALERT)                                                                 |

---

## 8. Suites de Prueba por Rol

### Suite A — SUPER_ADMIN / ADMIN (gestión de organización)

| Test | Endpoint                                                            | Resultado esperado       |
| ---- | ------------------------------------------------------------------- | ------------------------ |
| A-01 | POST /organizations/:id/members `{ email, role: "MANAGER" }`        | 201, member creado       |
| A-02 | POST /organizations/:id/members con MANAGER autenticado             | 403 FORBIDDEN            |
| A-03 | PATCH /organizations/:id/members/:userId `{ role: "VIEWER" }`       | 200, rol actualizado     |
| A-04 | DELETE /organizations/:id/members/:userId                           | 204, miembro removido    |
| A-05 | PATCH /companies/:id `{ name: "Nuevo", version: N }`                | 200, empresa actualizada |
| A-06 | PATCH /companies/:id con MANAGER autenticado                        | 403 FORBIDDEN            |
| A-07 | DELETE /companies/:id?version=N                                     | 204, soft-deleted        |
| A-08 | DELETE /echelons/:id?version=N                                      | 204, soft-deleted        |
| A-09 | DELETE /echelons/:id?version=N con MANAGER autenticado              | 403 FORBIDDEN            |
| A-10 | DELETE /auth/devices/:machineId                                     | 200, revocado            |
| A-11 | DELETE /auth/devices/:machineId con MEMBER autenticado              | 403 FORBIDDEN            |
| A-12 | PATCH /organizations/:id/members/:userId con version desactualizada | Verificar comportamiento |

### Suite B — MANAGER (operaciones de echelon)

| Test | Endpoint                                                                           | Resultado esperado            |
| ---- | ---------------------------------------------------------------------------------- | ----------------------------- |
| B-01 | POST /echelons `{ productId, name }`                                               | 201, echelon OPEN             |
| B-02 | POST /echelons con MEMBER autenticado                                              | 403 FORBIDDEN                 |
| B-03 | POST /echelons/:id/required-fields `{ label: "Campo 1" }`                          | 201                           |
| B-04 | PATCH /echelons/:id `{ name: "Nuevo", version: N }`                                | 200                           |
| B-05 | PATCH /echelons/:id con version desactualizada                                     | 409 CONFLICT                  |
| B-06 | PATCH /echelons/:id/transition `{ event: "START_SESSION", version: N }`            | 200, IN_PROGRESS              |
| B-07 | PATCH /echelons/:id/transition desde CLOSED (transición inválida)                  | 422 INVALID_TRANSITION        |
| B-08 | PATCH /echelons/:id/transition `{ event: "REJECT", version }` desde CLOSURE_REVIEW | 200, IN_PROGRESS              |
| B-09 | POST /echelons/:id/consolidate `{ version: N }` en estado IN_PROGRESS              | 200, CLOSURE_REVIEW           |
| B-10 | POST /echelons/:id/consolidate con MEMBER autenticado                              | 403 FORBIDDEN                 |
| B-11 | POST /echelons/:id/close `{ version: N }` en estado CLOSURE_REVIEW                 | 200, CLOSED                   |
| B-12 | POST /echelons/:id/close desde IN_PROGRESS (estado incorrecto)                     | 422 INVALID_TRANSITION        |
| B-13 | POST /echelons/:id/launch                                                          | 200, { deepLinkUrl, context } |

### Suite C — MEMBER (trabajo diario)

| Test | Endpoint                                                        | Resultado esperado                   |
| ---- | --------------------------------------------------------------- | ------------------------------------ |
| C-01 | GET /companies                                                  | 200, lista paginada                  |
| C-02 | GET /echelons?state=OPEN                                        | 200, filtrado                        |
| C-03 | POST /echelons/:id/sessions `{}`                                | 201, sesión creada                   |
| C-04 | POST /sessions/:id/summary con Idempotency-Key                  | 201, summary DRAFT                   |
| C-05 | POST /sessions/:id/summary mismo Idempotency-Key (retry)        | 200/201, mismo resultado             |
| C-06 | POST /sessions/:id/summary sin Idempotency-Key                  | 400 (falta header)                   |
| C-07 | GET /sessions/:id/summary                                       | 200, summary actual                  |
| C-08 | PATCH /sessions/:id/summary `{ event: "VALIDATE", version: N }` | 200, VALIDATED                       |
| C-09 | POST /auth/devices `{ machineId, userId }`                      | 201, device enrollado                |
| C-10 | POST /auth/devices misma machineId (idempotente)                | 200/201, mismo device                |
| C-11 | GET /devices                                                    | 200, lista de dispositivos de la org |
| C-12 | GET /usage?monthYear=2026-03                                    | 200, registros de uso                |
| C-13 | POST /usage `{ monthYear, tokens, model }` con Idempotency-Key  | 201                                  |
| C-14 | GET /context/:echelonId                                         | 200, bundle cacheado                 |
| C-15 | GET /notifications                                              | 200                                  |

### Suite D — VIEWER (solo lectura, debe fallar en escrituras)

| Test | Endpoint                                    | Resultado esperado                 |
| ---- | ------------------------------------------- | ---------------------------------- |
| D-01 | GET /companies                              | 200                                |
| D-02 | GET /echelons                               | 200                                |
| D-03 | POST /companies (con VIEWER)                | 201 **⚠️ DEBERÍA SER 403 — gap**   |
| D-04 | POST /echelons (con VIEWER)                 | 403 ✅ (ya tiene withRole MANAGER) |
| D-05 | POST /echelons/:id/sessions (con VIEWER)    | 201 **⚠️ DEBERÍA SER 403 — gap**   |
| D-06 | PATCH /echelons/:id/transition (con VIEWER) | 403 ✅                             |
| D-07 | PATCH /companies/:id (con VIEWER)           | 403 ✅                             |

### Suite E — Integración Assistant (flujo completo)

Ver archivo: `tests/e2e/assistant-contract.spec.ts`

| Test | Descripción                                                                      |
| ---- | -------------------------------------------------------------------------------- |
| E-01 | Enrolar dispositivo + validar (obtener accessToken)                              |
| E-02 | Obtener contexto bundle del echelon                                              |
| E-03 | Crear sesión → enviar summary (primer summary auto-transiciona OPEN→IN_PROGRESS) |
| E-04 | Reintentar POST summary con mismo Idempotency-Key → misma respuesta              |
| E-05 | Registrar uso LLM + verificar idempotencia                                       |
| E-06 | MANAGER valida summary → VALIDATED → contexto invalidado                         |
| E-07 | Consolidar → CLOSURE_REVIEW                                                      |
| E-08 | Cerrar echelon → CLOSED                                                          |
| E-09 | Intentar usar accessToken de device revocado                                     |
| E-10 | Rate limit: 10+ requests al context bundle en 5min                               |

### Suite F — Campos obligatorios / Validación de input

| Test | Endpoint                           | Input                       | Resultado esperado                  |
| ---- | ---------------------------------- | --------------------------- | ----------------------------------- |
| F-01 | POST /companies                    | `{}`                        | 422 — name requerido                |
| F-02 | POST /companies                    | `{ name: "A" }`             | 422 — name min 1 char (ok)          |
| F-03 | POST /echelons                     | `{ name: "X" }`             | 422 — productId requerido           |
| F-04 | POST /echelons/:id/required-fields | `{ label: "A" }`            | 422 — label min 2 chars             |
| F-05 | PATCH /companies/:id               | `{ name: "X" }` sin version | 422 — version requerido             |
| F-06 | POST /echelons/:id/consolidate     | `{}` sin version            | 400 — version requerido             |
| F-07 | POST /auth/devices                 | `{}`                        | 422 — machineId y userId requeridos |
| F-08 | POST /sessions/:id/summary         | `{}`                        | 422 — rawContent requerido          |
| F-09 | POST /usage                        | `{ tokens: "abc" }`         | 422 — tokens debe ser number        |
| F-10 | POST /organizations/:id/members    | `{ email: "notanemail" }`   | 422 — email inválido                |

### Suite G — Concurrencia y Optimistic Locking

| Test | Descripción                                                 | Resultado esperado                       |
| ---- | ----------------------------------------------------------- | ---------------------------------------- |
| G-01 | Dos PATCH simultáneos al mismo echelon con el mismo version | El segundo recibe 409 CONFLICT           |
| G-02 | PATCH con version desactualizada (version < actual)         | 409 CONFLICT                             |
| G-03 | DELETE con version desactualizada                           | 409 o error de constraint                |
| G-04 | Dos POST summary con mismo Idempotency-Key en paralelo      | Uno recibe 409 "processing", el otro 201 |

---

## 9. Pantallas del Backoffice por Rol

### Pantallas accesibles (según autenticación y navegación)

| Pantalla               | Ruta                          | VIEWER                  | MEMBER | MANAGER | ADMIN | SUPER_ADMIN |
| ---------------------- | ----------------------------- | ----------------------- | ------ | ------- | ----- | ----------- |
| Dashboard              | `/`                           | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Empresas               | `/companies`                  | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Detalle Empresa        | `/companies/:id`              | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Detalle Producto       | `/products/:id`               | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Detalle Echelon        | `/echelons/:id`               | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Detalle Sesión         | `/sessions/:id`               | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Revisión Consolidación | `/echelons/:id/consolidation` | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Dispositivos           | `/devices`                    | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Budget                 | `/budget`                     | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Audit Log              | `/audit-log`                  | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Miembros               | `/members`                    | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Settings               | `/settings`                   | ✅                      | ✅     | ✅      | ✅    | ✅          |
| Onboarding             | `/onboarding`                 | Solo antes de tener org |

**Nota:** La diferenciación de qué _acciones_ están habilitadas dentro de cada pantalla
depende del rol y está reflejada en las Suites de Prueba §8. La navegación en sí
no está restringida por rol en el frontend actualmente.

---

## 10. Hallazgos Prioritarios para el Plan de QA

### 🔴 Alta prioridad

1. **G12 / O2** — El audit log es visible por cualquier miembro. Expone historial completo de operaciones de toda la organización.
2. **O1** — `GET /auth/devices/:machineId` sin autenticación retorna accessToken. Si alguien conoce un machineId válido, obtiene un token de acceso.
3. **O3** — El userId en el body de enrolamiento no se valida contra el token de auth. Un usuario podría enrolar un device en nombre de otro usuario.

### 🟡 Media prioridad

4. **G1-G7, G11, G13-G14** — Múltiples endpoints de escritura sin restricción de rol. Cualquier MEMBER puede crear empresas, productos, campos obligatorios, y lanzar el assistant.
5. **G8-G10** — Sessions sin restricción: cualquier miembro puede crear, editar y eliminar sesiones de cualquier echelon de la organización.

### 🟢 Baja prioridad

6. **VIEWER = MEMBER** — El rol VIEWER no tiene restricciones adicionales, lo que lo hace funcionalmente equivalente a MEMBER en endpoints de escritura.
7. **O4** — El POST summary no verifica que la sesión pertenezca al echelon del contexto del tenant.

---

_Documento generado mediante auditoría directa del código fuente.
Revisado sobre: 40 route handlers, 16 módulos de dominio, 8 schemas Zod._
