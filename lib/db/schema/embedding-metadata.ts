import type { InferSelectModel } from "drizzle-orm";
import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const embeddingModelMetadata = pgTable("embedding_model_metadata", {
  modelId: varchar("model_id", { length: 128 }).primaryKey().notNull(),
  chunkSize: integer("chunk_size").notNull(),
  chunkOverlap: integer("chunk_overlap").notNull(),
  embeddedAt: timestamp("embedded_at").notNull().defaultNow(),
});

export type EmbeddingModelMetadata = InferSelectModel<
  typeof embeddingModelMetadata
>;
