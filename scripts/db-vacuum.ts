/**
 * VACUUM ANALYZE on high-churn tables. Run: pnpm exec tsx scripts/db-vacuum.ts
 * Output: JSON to stdout.
 */
import { prisma } from '../src/lib/prisma';

const HIGH_CHURN_TABLES = ['usage_records', 'audit_logs', 'sessions', 'jobs'];

async function main(): Promise<void> {
  const results: Array<{ table: string; status: string }> = [];
  for (const table of HIGH_CHURN_TABLES) {
    try {
      await prisma.$executeRawUnsafe(`VACUUM ANALYZE ${table}`);
      results.push({ table, status: 'ok' });
    } catch (err: unknown) {
      results.push({ table, status: String(err) });
    }
  }
  process.stdout.write(JSON.stringify(results, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    process.stderr.write(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
