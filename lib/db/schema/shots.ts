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

const VECTOR_DIMENSIONS = 1536;

export const shots = pgTable(
  "shots",
  {
    id: uuid("id").notNull().defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
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

export const shotEmbeddings = pgTable(
  "shot_embeddings",
  {
    id: uuid("id").notNull().defaultRandom().primaryKey(),
    shotId: uuid("shot_id")
      .notNull()
      .references(() => shots.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: VECTOR_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    shotIdIdx: index("shot_embeddings_shot_id_idx").on(table.shotId),
    embeddingIndex: index("embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  })
);

export type ShotEmbedding = InferSelectModel<typeof shotEmbeddings>;
