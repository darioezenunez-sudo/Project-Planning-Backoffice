/**
 * Wrapper for prisma db seed. Run: pnpm exec tsx scripts/db-seed.ts
 * Delegates to prisma db seed (see package.json "prisma": { "seed": "tsx prisma/seed.ts" }).
 */
import { execSync } from 'node:child_process';

function main(): void {
  execSync('pnpm exec prisma db seed', { stdio: 'inherit', cwd: process.cwd() });
}

main();
