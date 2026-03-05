-- Add shot_embeddings_2560 for alibaba/qwen3-embedding-4b
-- pgvector limits indexes to 2000 dimensions; no index for 2560

CREATE TABLE IF NOT EXISTS shot_embeddings_2560 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shot_id uuid NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(2560) NOT NULL,
  model_id varchar(128) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS shot_embeddings_2560_shot_id_idx ON shot_embeddings_2560 (shot_id);
CREATE INDEX IF NOT EXISTS shot_embeddings_2560_model_id_idx ON shot_embeddings_2560 (model_id);
