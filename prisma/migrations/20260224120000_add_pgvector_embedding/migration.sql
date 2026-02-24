-- Enable pgvector extension (Fase 3 — ranked retrieval).
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to executive_summaries for similarity search (768 dimensions).
ALTER TABLE "executive_summaries"
ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- HNSW index for cosine similarity (ENGINEERING_STANDARDS §T.11).
CREATE INDEX IF NOT EXISTS "idx_summaries_embedding"
ON "executive_summaries"
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
