# Crear nuevo módulo de dominio

Reemplazar `{MODULE}` con el nombre en kebab-case (ej: `notification`, `integration`).
Reemplazar `{Module}` con PascalCase (ej: `Notification`, `Integration`).

Seguir estos pasos **en orden**. No saltar ninguno. Al final ejecutar `pnpm validate`.

---

## 1. Schema — `src/schemas/{MODULE}.schema.ts`

- Zod schemas para create, update, list query, y response
- Tipos con `z.infer<typeof schema>` — **NUNCA** tipos manuales
- Importar `paginationQuerySchema` de `@/schemas/shared.schema`
- Si tiene FSM: incluir enum de estados y eventos

## 2. Repository — `src/modules/{MODULE}/{MODULE}.repository.ts`

- **Factory function** `createXxxRepository()` — NO clases
- `select` object con `satisfies Prisma.XxxSelect`
- `XxxRow = Prisma.XxxGetPayload<{ select: typeof xxxSelect }>`
- Cursor pagination con `buildCursorPagination` si el módulo tiene lista
- Soft delete con `softDeleteData()` de `@/lib/prisma`
- Optimistic locking: `where: { id, organizationId, version }` en update/softDelete
- NO nested ternaries — usar if/else para asignaciones condicionales

## 3. Service — `src/modules/{MODULE}/{MODULE}.service.ts`

- **Factory function** `createXxxService(repo: XxxRepository)` — NO clases
- Todos los métodos retornan `Promise<Result<T, AppError>>`
- NOT_FOUND: `new AppError(ErrorCode.NOT_FOUND, 404, '{Module} {id} not found')`
- CONFLICT: `new AppError(ErrorCode.CONFLICT, 409, 'Version conflict...')`
- NUNCA importar `prisma` directamente en el service
- Si tiene FSM: importar el state machine, llamarlo ANTES de persistir

## 4. Route handlers

- `src/app/api/v1/{MODULE}/route.ts` — GET (list) + POST (create)
- `src/app/api/v1/{MODULE}/[id]/route.ts` — GET + PATCH + DELETE
- Siempre: `compose(withAuth, withTenant, withRole(...))`
- Lista: agregar `withValidation({ query: listXxxQuerySchema })`
- Create/update: agregar `withValidation({ body: createXxxSchema })`
- POST que mutan datos críticos: agregar `withAudit('{Module}')` y evaluar `withIdempotency`
- **Nunca** poner lógica de negocio en el handler — solo delegar al service

## 5. Tests — `tests/unit/modules/{MODULE}.service.test.ts`

- Mock del repository completo con `vi.fn()`
- Cubrir: happy path (ok: true), NOT_FOUND (404), CONFLICT versión (409)
- Pattern obligatorio para acceder a error:
  ```typescript
  expect(result.ok).toBe(false);
  if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
  ```
- Si tiene FSM: test en `tests/unit/lib/{MODULE}-fsm.test.ts` con 100% de paths

## 6. RBAC — `src/lib/rbac/permissions.ts`

Agregar permisos si el módulo expone recursos de negocio:

```typescript
'{MODULE}:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
'{MODULE}:write': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
'{MODULE}:delete': ['SUPER_ADMIN', 'ADMIN'],
```

## 7. DI Container — `src/lib/di/container.ts`

Registrar el factory del servicio. Inyectar el repository como dependencia.

---

## Verificación final

```bash
pnpm validate   # lint + tsc + tests — debe ser 100% green
```

Si falla: corregir antes de commitear. No commitear con validate rojo.
