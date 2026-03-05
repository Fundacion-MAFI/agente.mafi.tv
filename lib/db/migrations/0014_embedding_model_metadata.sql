-- Store chunk_size and chunk_overlap used when embeddings were created per model

CREATE TABLE IF NOT EXISTS embedding_model_metadata (
  model_id varchar(128) PRIMARY KEY NOT NULL,
  chunk_size integer NOT NULL,
  chunk_overlap integer NOT NULL,
  embedded_at timestamp DEFAULT now() NOT NULL
);
