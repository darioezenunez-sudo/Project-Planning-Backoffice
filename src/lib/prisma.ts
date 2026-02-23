import { PrismaClient } from '@prisma/client';

// Models that support soft-delete via the deletedAt column.
const SOFT_DELETE_MODELS = new Set([
  'Organization',
  'User',
  'OrganizationMember',
  'Company',
  'Product',
  'Echelon',
  'RequiredField',
  'DecisionLink',
  'Session',
  'ExecutiveSummary',
  'Attachment',
  'Device',
  'UsageRecord',
]);

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Prisma 5+ query extensions replace the deprecated $use middleware.
  // Intercept all read operations on soft-deletable models to automatically
  // exclude deleted records unless the caller has already specified deletedAt.
  return base.$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic extension requires any
        $allOperations({ model, operation, args, query }: any) {
          const readOps = [
            'findFirst',
            'findUnique',
            'findMany',
            'count',
            'findFirstOrThrow',
            'findUniqueOrThrow',
            'aggregate',
          ];
          if (SOFT_DELETE_MODELS.has(model as string) && readOps.includes(operation as string)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- any-typed extension args
            args.where = args.where ?? {};
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- any-typed extension args
            if (!Object.prototype.hasOwnProperty.call(args.where, 'deletedAt')) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- any-typed extension args
              args.where.deletedAt = null;
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- any-typed extension args
          return query(args);
        },
      },
    },
  });
}

type PrismaClientWithExtensions = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientWithExtensions | undefined;
};

export const prisma: PrismaClientWithExtensions = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Soft-delete filter for Prisma WHERE clauses.
 * Use in repository queries that need to bypass the automatic extension filter,
 * or when including deleted records for audit/restore purposes.
 *
 * @example
 * // Default: extension already applies this — explicit only when needed
 * await prisma.company.findMany({ where: { ...notDeleted, organizationId } });
 *
 * // Include deleted (bypass auto-filter by specifying deletedAt explicitly):
 * await prisma.company.findMany({ where: { organizationId } }); // won't work with extension
 * // Instead pass deletedAt: { not: null } or skip the where key entirely
 */
export const notDeleted = { deletedAt: null } as const;

/**
 * Returns the data payload for a Prisma soft-delete update.
 * Use in repository delete methods instead of calling prisma.model.delete().
 */
export function softDeleteData(): { deletedAt: Date; version: { increment: number } } {
  return { deletedAt: new Date(), version: { increment: 1 } };
}
