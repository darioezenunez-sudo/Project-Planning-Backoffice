import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  // Next.js recommended rules (compat layer for flat config)
  ...compat.extends('next/core-web-vitals'),

  // TypeScript strict type-checked rules
  ...tseslint.configs.strictTypeChecked,

  // Global settings
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },

  // Source code rules
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      // --- No console (use pino logger) ---
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // --- TypeScript strict ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // --- Code quality ---
      'no-nested-ternary': 'error',
      complexity: ['warn', 10],
      'max-depth': ['warn', 3],

      // --- Import order ---
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@/**', group: 'internal', position: 'before' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },

  // Relax rules for test files
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'max-lines-per-function': 'off',
    },
  },

  // Relax rules for config files
  {
    files: ['*.config.{ts,mjs,cjs,js}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Route handlers: stub handlers are async by Next.js contract even without await yet.
  // This exemption is intentional and documented — remove per-handler as stubs are implemented.
  {
    files: ['src/app/api/**/*.ts', 'src/lib/cache/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: [
      '.next/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'prisma/migrations/',
      '.vercel/',
    ],
  }
);
