/**
 * EXPLAIN ANALYZE for critical queries. Run: pnpm exec tsx scripts/db-analyze.ts
 * Output: JSON to stdout.
 */
import { prisma } from '../src/lib/prisma';

const CRITICAL_QUERIES = [
  {
    name: 'echelons_by_org',
    sql: `SELECT * FROM echelons WHERE organization_id = '00000000-0000-0000-0000-000000000000' AND deleted_at IS NULL LIMIT 20`,
  },
  {
    name: 'sessions_by_echelon',
    sql: `SELECT * FROM sessions WHERE echelon_id = '00000000-0000-0000-0000-000000000000' AND deleted_at IS NULL LIMIT 20`,
  },
  {
    name: 'summaries_validated',
    sql: `SELECT * FROM executive_summaries WHERE state = 'VALIDATED' AND deleted_at IS NULL LIMIT 20`,
  },
];

async function main(): Promise<void> {
  const results: Array<{ name: string; plan: string }> = [];
  for (const { name, sql } of CRITICAL_QUERIES) {
    const explainSql = `EXPLAIN (ANALYZE, COSTS, FORMAT TEXT) ${sql}`;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(explainSql);
    const plan = rows
      .map((r) => (r['QUERY PLAN'] ?? r['query plan'] ?? Object.values(r)[0]) as string)
      .join('\n');
    results.push({ name, plan });
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
