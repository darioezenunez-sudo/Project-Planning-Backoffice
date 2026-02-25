/**
 * Wrapper for prisma migrate reset (drop + recreate + seed). Dev only.
 * Run: pnpm exec tsx scripts/db-reset.ts
 */
import { execSync } from 'node:child_process';

function main(): void {
  execSync('pnpm exec prisma migrate reset --force', { stdio: 'inherit', cwd: process.cwd() });
}

main();
