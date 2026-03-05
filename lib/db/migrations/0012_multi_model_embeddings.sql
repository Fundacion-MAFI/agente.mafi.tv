-- Multi-model embedding tables: one per vector dimension.
-- Each table stores embeddings for models that output that dimension.
-- model_id identifies which model produced the embedding (required for retrieval).

CREATE TABLE IF NOT EXISTS shot_embeddings_384 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(384) NOT NULL,
  model_id varchar(128) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS shot_embeddings_384_shot_id_idx ON shot_embeddings_384 (shot_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_384_model_id_idx ON shot_embeddings_384 (model_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_384_embedding_idx ON shot_embeddings_384 USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS shot_embeddings_768 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(768) NOT NULL,
  model_id varchar(128) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS shot_embeddings_768_shot_id_idx ON shot_embeddings_768 (shot_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_768_model_id_idx ON shot_embeddings_768 (model_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_768_embedding_idx ON shot_embeddings_768 USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS shot_embeddings_1024 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1024) NOT NULL,
  model_id varchar(128) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS shot_embeddings_1024_shot_id_idx ON shot_embeddings_1024 (shot_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_1024_model_id_idx ON shot_embeddings_1024 (model_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_1024_embedding_idx ON shot_embeddings_1024 USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS shot_embeddings_1536 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  model_id varchar(128) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS shot_embeddings_1536_shot_id_idx ON shot_embeddings_1536 (shot_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_1536_model_id_idx ON shot_embeddings_1536 (model_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_1536_embedding_idx ON shot_embeddings_1536 USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS shot_embeddings_3072 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(3072) NOT NULL,
  model_id varchar(128) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS shot_embeddings_3072_shot_id_idx ON shot_embeddings_3072 (shot_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_3072_model_id_idx ON shot_embeddings_3072 (model_id);
-- pgvector limits indexes to 2000 dimensions; 3072/4096 use sequential scan
-- (acceptable for small archives; add index when pgvector supports higher dims)

CREATE TABLE IF NOT EXISTS shot_embeddings_4096 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(4096) NOT NULL,
  model_id varchar(128) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS shot_embeddings_4096_shot_id_idx ON shot_embeddings_4096 (shot_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_4096_model_id_idx ON shot_embeddings_4096 (model_id);
-- pgvector limits indexes to 2000 dimensions; no index for 4096

-- Migrate existing shot_embeddings data to shot_embeddings_1536 (if old table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shot_embeddings') THEN
    INSERT INTO shot_embeddings_1536 (shot_id, content, embedding, model_id, created_at)
    SELECT shot_id, content, embedding, 'openai/text-embedding-3-small', created_at
    FROM shot_embeddings;
    DROP TABLE shot_embeddings;
  END IF;
END $$;

