# Commitear una fase completa

Reemplazar `{N}` con el número de la fase (ej: `3`, `4`, `5`).

**ANTES de ejecutar cualquier commit:** verificar que `pnpm validate` esté green.

---

## Commits en orden

Ejecutar cada grupo por separado. Adaptar según qué artefactos tiene la fase concreta.

### 1. Schemas

```bash
git add src/schemas/
git status --short   # revisar qué se va a commitear
git commit -m "feat(fase-{N}/schema): <descripción corta de los schemas>"
```

### 2. DB (si hay cambios de schema o migrations)

```bash
git add prisma/ supabase/migrations/
git status --short
git commit -m "feat(fase-{N}/db): <descripción de los cambios de DB>"
```

### 3. Repositories (infra)

```bash
git add src/modules/**/*.repository.ts src/modules/**/*.state-machine.ts
git status --short
git commit -m "feat(fase-{N}/infra): <descripción de repositories y FSMs>"
```

### 4. Services (domain)

```bash
git add src/modules/**/*.service.ts
git status --short
git commit -m "feat(fase-{N}/domain): <descripción de services implementados>"
```

### 5. Route handlers (api)

```bash
git add src/app/api/
git status --short
git commit -m "feat(fase-{N}/api): <descripción de endpoints>"
```

### 6. Tests

```bash
git add tests/
git status --short
git commit -m "test(fase-{N}): <descripción> (N tests passing)"
```

### 7. Docs (si hay ADRs, diagramas, o updates de documentación)

```bash
git add docs/
git status --short
git commit -m "docs(fase-{N}): <descripción de cambios de documentación>"
```

---

## Reglas de commit

- **Máximo ~10 archivos por commit**
- Nunca `git add .` ni `git add -A`
- Siempre revisar `git status --short` o `git diff --staged --name-only` antes de commitear
- Mensaje: Conventional Commits — verbo en infinitivo, descripción corta
- Cada commit debe dejar el build en verde (no romper a mitad de fase)

## Post-commit

```bash
git push origin feat/fase-{N}
# Luego abrir PR: feat/fase-{N} → develop
```
