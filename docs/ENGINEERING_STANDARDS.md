# ENGINEERING_STANDARDS.md — Project-Planning-Backoffice Coding Standards

> **Version:** 1.0.0 | **Updated:** 2026-02-28
> Quick context → `CLAUDE.md` | Technical reference → `docs/ARCHITECTURE.md`

---

## 1. Core Paradigm

**Functional-first.** No classes for domain logic. Use pure functions, factory functions, and composable utilities. The only class is `AppError` (needs `instanceof` checks).

```ts
// ✅ Correct — factory function, plain object
export function createCompanyRepository(prisma: PrismaClient) {
  return {
    async findById(id: string, organizationId: string) { ... },
    async create(data: CreateCompanyInput) { ... },
  }
}

// ❌ Wrong — class with methods
export class CompanyRepository {
  constructor(private prisma: PrismaClient) {}
  async findById(...) { ... }
}
```

---

## 2. Result Pattern (no throws)

**Never throw from services or repositories.** Always return `Result<T, AppError>`.

```ts
import { ok, err, type Result } from '@/lib/result';
import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';

// ✅ Service function signature
export async function getCompany(id: string, orgId: string): Promise<Result<Company, AppError>> {
  const company = await repo.findById(id, orgId);
  if (!company) return err(new AppError(ErrorCode.NOT_FOUND, 404, 'Company not found'));
  return ok(company);
}

// ✅ Route handler consuming result
const result = await getCompany(id, ctx.organizationId);
if (isErr(result))
  return apiError(result.error.code, result.error.message, result.error.httpStatus);
return apiSuccess(result.value);
```

AppError properties: `code: ErrorCode`, `httpStatus: number`, `message: string`, `context?: unknown`, `cause?: Error`.

> Note: property is `httpStatus`, NOT `statusCode`.

---

## 3. Repository Pattern

Services never import `prisma` directly. They receive a repository from a factory.

```ts
// src/modules/company/company.repository.ts
export function createCompanyRepository(db: PrismaClient) {
  return {
    async findMany(orgId: string, cursor?: string, limit = 20) {
      return db.company.findMany({
        where: { organizationId: orgId, ...notDeleted },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      })
    },
  }
}

// src/modules/company/company.service.ts — receives repo, never db
export function createCompanyService(repo: ReturnType<typeof createCompanyRepository>) {
  return {
    async list(orgId: string, ...): Promise<Result<...>> { ... }
  }
}

// src/app/api/v1/companies/route.ts — wires it up
const repo = createCompanyRepository(prisma)
const service = createCompanyService(repo)
```

---

## 4. Zod as Single Source of Truth

All types are inferred from Zod schemas. No manual `interface` or `type` for domain objects.

```ts
// src/schemas/company.schema.ts
import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  taxId: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
// ✅ This is the ONLY source of the type — no duplicate interface
```

Schemas live in `src/schemas/*.schema.ts`. Route handlers pass schema to `withValidation(schema)`.

---

## 5. FSM (Finite State Machine)

State transitions are pure functions — no side effects.

```ts
// src/modules/echelon/echelon.fsm.ts

const VALID_TRANSITIONS: Record<EchelonStatus, EchelonStatus[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['CLOSING'],
  CLOSING: ['CLOSURE_REVIEW'],
  CLOSURE_REVIEW: ['CLOSED', 'IN_PROGRESS'], // only backward allowed
  CLOSED: [],
};

export function canTransition(from: EchelonStatus, to: EchelonStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(
  current: EchelonStatus,
  next: EchelonStatus,
): Result<EchelonStatus, AppError> {
  if (!canTransition(current, next))
    return err(
      new AppError(
        ErrorCode.ECHELON_INVALID_TRANSITION,
        422,
        `Cannot transition ${current} → ${next}`,
      ),
    );
  return ok(next);
}
```

---

## 6. Database Standards

### Soft Delete — Always

```ts
import { softDeleteData, notDeleted } from '@/lib/prisma';

// Read (auto-filtered by Prisma extension for SOFT_DELETE_MODELS)
// For explicit queries add: where: { ...notDeleted }

// Delete
await prisma.company.updateMany({
  where: { id, organizationId, version },
  data: softDeleteData(), // { deletedAt: new Date(), version: { increment: 1 } }
});
```

### Optimistic Locking — All Mutable Operations

```ts
const count = await prisma.company.updateMany({
  where: { id, organizationId, version: dto.version },
  data: { name: dto.name, version: { increment: 1 } },
});
if (count.count === 0)
  return err(new AppError(ErrorCode.CONFLICT, 409, 'Version conflict or not found'));
```

### Query Rules

- Always include `organizationId` in every query (multi-tenant isolation)
- Always include `...notDeleted` in manual queries outside auto-filtered methods
- Prefer `findFirst` over `findUnique` when combining with `organizationId` (composite)
- Never use `prisma.entity.delete()` — always soft delete

---

## 7. TypeScript Rules

| Rule                             | Enforcement  | Notes                                          |
| -------------------------------- | ------------ | ---------------------------------------------- |
| `strict: true`                   | tsconfig     | Includes noImplicitAny, strictNullChecks, etc. |
| `noUncheckedIndexedAccess: true` | tsconfig     | Array/object access returns `T \| undefined`   |
| `noImplicitReturns: true`        | tsconfig     | All code paths must return                     |
| No `any`                         | ESLint error | Use `unknown` and narrow                       |
| No `!` assertions                | ESLint error | Use optional chaining or type guards           |
| No `console.log`                 | ESLint error | Use `logger` from `@/lib/logger`               |

```ts
// ✅ noUncheckedIndexedAccess — always guard array access
const first = items[0]
if (!first) return err(...)

// ✅ unknown instead of any
function parse(raw: unknown): Result<ParsedData, AppError> {
  const parsed = mySchema.safeParse(raw)
  if (!parsed.success) return err(...)
  return ok(parsed.data)
}
```

---

## 8. Array and Loop Rules

```ts
// ✅ Functional transformations
const names = companies.map((c) => c.name);
const active = companies.filter((c) => !c.deletedAt);
const total = amounts.reduce((sum, n) => sum + n, 0);

// ✅ for...of when you need early return or async
for (const item of items) {
  const result = await processItem(item);
  if (isErr(result)) return result;
}

// ❌ Never traditional for(let i=0; ...) for domain logic
// ❌ Never forEach with side effects that need await
```

---

## 9. Naming Conventions

| Element          | Convention                | Example                   |
| ---------------- | ------------------------- | ------------------------- |
| Files            | kebab-case                | `company-service.ts`      |
| Functions        | camelCase                 | `createCompanyService()`  |
| Types/interfaces | PascalCase                | `CreateCompanyInput`      |
| Constants        | UPPER_SNAKE               | `DEFAULT_LIMIT = 20`      |
| Zod schemas      | camelCase + Schema suffix | `createCompanySchema`     |
| DB columns       | snake_case (Prisma maps)  | `organization_id`         |
| API routes       | kebab-case segments       | `/api/v1/required-fields` |
| React components | PascalCase                | `CompanyCard.tsx`         |
| Hooks            | camelCase + use prefix    | `useCompanies()`          |
| Stores           | camelCase + Store suffix  | `useSidebarStore()`       |

---

## 10. ESLint Key Rules

| Rule                               | Config           | Why                         |
| ---------------------------------- | ---------------- | --------------------------- |
| `no-console: error`                | all              | Use logger                  |
| `@ts/no-explicit-any: error`       | all              | Type safety                 |
| `@ts/no-non-null-assertion: error` | all              | Safety                      |
| `import/order: error`              | all              | Consistent imports          |
| `complexity: 15`                   | default          | Increased to 30 for screens |
| `@ts/require-await: off`           | api/**, cache/** | Async by Next.js contract   |

**Import order** (enforced, blank line between groups):

1. External scoped (`@ai-sdk/openai`, `@supabase/ssr`)
2. External unscoped (`next`, `react`, `zod`)
3. Internal alias (`@/lib/*`, `@/schemas/*`, `@/modules/*`)
4. Relative (`./`, `../`)

---

## 11. Logging

```ts
import { logger } from '@/lib/logger';

// ✅ Structured logging with context
logger.info({ companyId: id, action: 'create' }, 'Company created');
logger.error({ err, requestId: ctx.requestId }, 'Failed to process job');

// Automatic enrichment from AsyncLocalStorage:
// { requestId, userId, organizationId, role } injected into every log entry

// Secrets auto-redacted: password, token, apiKey, api_key, secret, authorization, cookie
```

---

## 12. Testing Standards

| Category | Tool              | Location        | Threshold       |
| -------- | ----------------- | --------------- | --------------- |
| Unit     | Vitest v3 + jsdom | `tests/unit/**` | 70% all metrics |
| E2E      | Playwright v1.52  | `tests/e2e/**`  | N/A             |

**Unit test patterns:**

```ts
// Mock prisma always — never hit real DB in unit tests
vi.mock('@/lib/prisma', () => ({
  prisma: { company: { findMany: vi.fn(), updateMany: vi.fn() } },
}));

// Mock logger — prevents noise in test output
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Test RBAC per role — always test all 5 roles when middleware is involved
const roles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const;
```

**E2E patterns:**

- Base URL: `PLAYWRIGHT_BASE_URL` env var (default: http://localhost:3000)
- Locale: `es`
- Healthcheck before run: `/api/v1/health?shallow=true`
- Chromium only, 2 retries on CI

---

## 13. Commit Conventions

Format: `type(scope): description` — max 100 chars header

**Types:** `feat` | `fix` | `test` | `refactor` | `docs` | `chore` | `ci` | `perf`

**Scopes:** `auth` | `ci` | `deps` | `config` | `schema` | `domain` | `infra` | `api` | `db` | `test` | `ui` | `components` | `pages` | `echelon` | `session` | `summary` | `budget` | `device` | `integration` | `docs` | `roadmap`

```
✅ feat(api): add cursor pagination to /companies endpoint
✅ fix(echelon): prevent CLOSED→IN_PROGRESS transition
✅ test(auth): add RBAC tests for withTenant middleware
❌ feat: added stuff
❌ fix(auth): Fixed the bug with the thing that wasn't working correctly before
```

Max ~10 files per commit. Never `git add .` (risk of committing `.env`, credentials, large files).

---

## 14. Key Anti-Patterns (Never Do)

```ts
// ❌ Direct prisma in route handler
export async function GET(req: NextRequest) {
  const companies = await prisma.company.findMany(); // NO
}

// ❌ Throw from service
export async function getCompany(id: string) {
  const c = await repo.findById(id);
  if (!c) throw new Error('Not found'); // NO — return err(...)
}

// ❌ Manual type that duplicates Zod schema
interface CreateCompanyInput {
  name: string;
  taxId?: string;
} // NO — use z.infer<>

// ❌ Hard delete
await prisma.company.delete({ where: { id } }); // NO — use softDeleteData()

// ❌ Mutation without version check
await prisma.company.update({ where: { id }, data: { name } }); // NO — include version

// ❌ console.log
console.log('Debug:', data); // NO — use logger.debug({ data }, 'Debug')

// ❌ Tailwind v4 syntax in components
// @import "tailwindcss"  // NO — v3 only: @tailwind base; @tailwind components; etc.
```
