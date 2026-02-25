/**
 * DB health check: connection, table sizes, index usage, dead tuples, cache hit ratio.
 * Run: pnpm exec tsx scripts/db-health.ts
 * Output: JSON to stdout.
 */
import { prisma } from '../src/lib/prisma';

async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function query<T>(sql: string): Promise<T> {
  return prisma.$queryRawUnsafe(sql) as Promise<T>;
}

async function main(): Promise<void> {
  const connectionOk = await testConnection();
  const [tableSizes, indexUsage, deadTuples, cacheHitRatio, connectionCount, dbSize] =
    await Promise.all([
      query<Array<{ relname: string; pg_size_pretty: string }>>(
        `SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS pg_size_pretty
         FROM pg_catalog.pg_statio_user_tables
         ORDER BY pg_total_relation_size(relid) DESC`,
      ),
      query<
        Array<{ relname: string; indexrelname: string; idx_scan: bigint; idx_tup_read: bigint }>
      >(
        `SELECT relname, indexrelname, idx_scan, idx_tup_read
         FROM pg_stat_user_indexes ORDER BY idx_scan ASC LIMIT 20`,
      ),
      query<
        Array<{
          relname: string;
          n_dead_tup: string;
          last_vacuum: Date | null;
          last_autovacuum: Date | null;
        }>
      >(
        `SELECT relname, n_dead_tup::text, last_vacuum, last_autovacuum
         FROM pg_stat_user_tables WHERE n_dead_tup > 1000`,
      ),
      query<
        Array<{
          ratio: number | null;
        }>
      >(
        `SELECT CASE
           WHEN (sum(heap_blks_hit) + sum(heap_blks_read)) = 0 THEN NULL
           ELSE sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read))::numeric
         END AS ratio
         FROM pg_statio_user_tables`,
      ),
      query<Array<{ count: bigint }>>(`SELECT count(*) FROM pg_stat_activity`),
      query<Array<{ pg_size_pretty: string }>>(
        `SELECT pg_size_pretty(pg_database_size(current_database())) AS pg_size_pretty`,
      ),
    ]);

  const result = {
    connectionOk,
    tableSizes,
    indexUsage: indexUsage.map((r) => ({
      ...r,
      idx_scan: Number(r.idx_scan),
      idx_tup_read: Number(r.idx_tup_read),
    })),
    deadTuples,
    cacheHitRatio: cacheHitRatio[0]?.ratio ?? null,
    connectionCount: connectionCount[0] ? Number(connectionCount[0].count) : 0,
    dbSize: dbSize[0]?.pg_size_pretty ?? null,
  };
  process.stdout.write(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    process.stderr.write(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
