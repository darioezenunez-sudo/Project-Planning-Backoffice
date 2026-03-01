import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],

      // Unit-test scope: business logic only.
      // Route handlers, pages, hooks, screens, schemas → Playwright E2E.
      include: ['src/modules/**/*.ts', 'src/lib/**/*.ts', 'src/components/shared/**/*.tsx'],

      exclude: [
        // ── lib: runtime-only / infrastructure singletons ──────────────────
        // These connect to real external services and cannot be unit-tested.
        'src/lib/prisma.ts', // Prisma singleton — real DB
        'src/lib/env.ts', // reads process.env at startup
        'src/lib/pgvector.ts', // raw SQL against DB
        'src/lib/cache/kv.ts', // Redis client — Upstash
        'src/lib/cache/tags.ts', // simple string constants
        'src/lib/ai/provider.ts', // OpenAI SDK — external API
        'src/lib/ai/consolidation.prompt.ts', // template string, no logic
        'src/lib/ai/consolidation.schema.ts', // declarative Zod schema
        'src/lib/supabase/client.ts', // browser client — runtime only
        'src/lib/supabase/middleware.ts', // Next.js middleware helper
        'src/lib/supabase/server.ts', // server client factory
        'src/lib/supabase/admin.ts', // admin client factory
        'src/lib/supabase/storage.ts', // Supabase storage service
        'src/lib/di/container.ts', // DI wiring
        'src/lib/validation/schemas.ts', // declarative Zod schemas
        'src/lib/errors/index.ts', // barrel re-export
        'src/lib/middleware/index.ts', // barrel re-export

        // ── modules: simple CRUD repositories ──────────────────────────────
        // Thin Prisma pass-throughs; tested via Playwright E2E.
        // Complex repos (echelon, session, summary) stay in scope.
        'src/modules/attachment/attachment.repository.ts',
        'src/modules/audit/audit.repository.ts',
        'src/modules/auth/device.repository.ts',
        'src/modules/auth/auth.guard.ts', // stub
        'src/modules/auth/auth.service.ts', // stub
        'src/modules/budget/budget.repository.ts',
        'src/modules/company/company.repository.ts',
        'src/modules/decision-link/decision-link.repository.ts',
        'src/modules/idempotency/idempotency.repository.ts',
        'src/modules/member/member.repository.ts',
        'src/modules/organization/organization.repository.ts',
        'src/modules/product/product.repository.ts',
        'src/modules/required-field/required-field.repository.ts',
        'src/modules/echelon/required-field.repository.ts', // simple CRUD, lives inside echelon module
        'src/modules/tenant/**', // stub module — no logic
        'src/modules/job/job.repository.ts', // simple queue CRUD

        // ── modules: integration output templates / strategies ──────────────
        // JSX render templates and trivial 1-5 line strategy stubs.
        'src/modules/integration/pdf.templates/**',
        'src/modules/integration/strategies/**',
      ],

      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
