/**
 * pgvector helpers (Fase 3). Prisma does not support vector natively; use raw SQL.
 * Requires extension: CREATE EXTENSION vector; and column executive_summaries.embedding vector(768).
 */
import { prisma } from '@/lib/prisma';

const EMBEDDING_DIMS = 768;

/**
 * Returns executive summary ids ordered by cosine similarity to the query embedding (nearest first).
 * Only rows with non-null embedding are considered.
 * Use for ranked retrieval in context bundle when a query embedding is available (e.g. Assistant query).
 */
export async function findSummaryIdsBySimilarity(
  echelonId: string,
  organizationId: string,
  queryEmbedding: number[],
  limit: number,
): Promise<string[]> {
  if (queryEmbedding.length !== EMBEDDING_DIMS) {
    return [];
  }
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `
    SELECT id FROM executive_summaries
    WHERE echelon_id = $1 AND organization_id = $2 AND deleted_at IS NULL AND embedding IS NOT NULL
    ORDER BY embedding <=> $3::vector
    LIMIT $4
    `,
    echelonId,
    organizationId,
    vectorStr,
    limit,
  );
  return rows.map((r) => r.id);
}
