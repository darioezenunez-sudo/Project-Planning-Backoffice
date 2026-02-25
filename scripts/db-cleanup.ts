/**
 * Hard delete of soft-deleted rows older than 90 days.
 * Run: pnpm exec tsx scripts/db-cleanup.ts
 * Output: JSON summary to stdout.
 */
import { prisma } from '../src/lib/prisma';

const TABLES_WITH_SOFT_DELETE = [
  'echelons',
  'sessions',
  'executive_summaries',
  'companies',
  'products',
  'devices',
  'attachments',
  'required_fields',
];

async function main(): Promise<void> {
  const deletedByTable: Record<string, number> = {};
  for (const table of TABLES_WITH_SOFT_DELETE) {
    const count = await prisma.$executeRawUnsafe(
      `DELETE FROM ${table} WHERE deleted_at < NOW() - INTERVAL '90 days'`,
    );
    deletedByTable[table] = count;
  }

  const idempotencyDeleted = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const auditDeleted = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: oneYearAgo } },
  });

  const result = {
    softDeleteCleanup: deletedByTable,
    idempotencyKeysDeleted: idempotencyDeleted.count,
    auditLogsDeleted: auditDeleted.count,
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
