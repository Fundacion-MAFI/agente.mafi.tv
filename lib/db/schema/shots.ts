import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const shots = pgTable(
  "shots",
  {
    id: uuid("id").notNull().defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    historicContext: text("historic_context"),
    vimeoUrl: text("vimeo_url"),
    date: text("date"),
    place: text("place"),
    author: text("author"),
    geotag: text("geotag"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("shots_slug_unique").on(table.slug),
  })
);

export type Shot = InferSelectModel<typeof shots>;

const EMBEDDING_DIMENSIONS = [384, 768, 1024, 1536, 2560, 3072, 4096] as const;

function createEmbeddingTableWithIndex(
  dim: (typeof EMBEDDING_DIMENSIONS)[number]
) {
  return pgTable(
    `shot_embeddings_${dim}`,
    {
      id: uuid("id").notNull().defaultRandom().primaryKey(),
      shotId: uuid("shot_id")
        .notNull()
        .references(() => shots.id, { onDelete: "cascade" }),
      content: text("content").notNull(),
      embedding: vector("embedding", { dimensions: dim }).notNull(),
      modelId: varchar("model_id", { length: 128 }).notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => ({
      shotIdIdx: index(`shot_embeddings_${dim}_shot_id_idx`).on(table.shotId),
      modelIdIdx: index(`shot_embeddings_${dim}_model_id_idx`).on(
        table.modelId
      ),
      embeddingIndex: index(`shot_embeddings_${dim}_embedding_idx`).using(
        "hnsw",
        table.embedding.op("vector_cosine_ops")
      ),
    })
  );
}

function createEmbeddingTableNoVectorIndex(
  dim: (typeof EMBEDDING_DIMENSIONS)[number]
) {
  return pgTable(
    `shot_embeddings_${dim}`,
    {
      id: uuid("id").notNull().defaultRandom().primaryKey(),
      shotId: uuid("shot_id")
        .notNull()
        .references(() => shots.id, { onDelete: "cascade" }),
      content: text("content").notNull(),
      embedding: vector("embedding", { dimensions: dim }).notNull(),
      modelId: varchar("model_id", { length: 128 }).notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => ({
      shotIdIdx: index(`shot_embeddings_${dim}_shot_id_idx`).on(table.shotId),
      modelIdIdx: index(`shot_embeddings_${dim}_model_id_idx`).on(
        table.modelId
      ),
    })
  );
}

export const shotEmbeddings384 = createEmbeddingTableWithIndex(384);
export const shotEmbeddings768 = createEmbeddingTableWithIndex(768);
export const shotEmbeddings1024 = createEmbeddingTableWithIndex(1024);
export const shotEmbeddings1536 = createEmbeddingTableWithIndex(1536);
export const shotEmbeddings2560 = createEmbeddingTableNoVectorIndex(2560);
export const shotEmbeddings3072 = createEmbeddingTableNoVectorIndex(3072);
export const shotEmbeddings4096 = createEmbeddingTableNoVectorIndex(4096);

export type ShotEmbedding384 = InferSelectModel<typeof shotEmbeddings384>;
export type ShotEmbedding768 = InferSelectModel<typeof shotEmbeddings768>;
export type ShotEmbedding1024 = InferSelectModel<typeof shotEmbeddings1024>;
export type ShotEmbedding1536 = InferSelectModel<typeof shotEmbeddings1536>;
export type ShotEmbedding2560 = InferSelectModel<typeof shotEmbeddings2560>;
export type ShotEmbedding3072 = InferSelectModel<typeof shotEmbeddings3072>;
export type ShotEmbedding4096 = InferSelectModel<typeof shotEmbeddings4096>;

export const SHOT_EMBEDDING_TABLES = {
  384: shotEmbeddings384,
  768: shotEmbeddings768,
  1024: shotEmbeddings1024,
  1536: shotEmbeddings1536,
  2560: shotEmbeddings2560,
  3072: shotEmbeddings3072,
  4096: shotEmbeddings4096,
} as const;
