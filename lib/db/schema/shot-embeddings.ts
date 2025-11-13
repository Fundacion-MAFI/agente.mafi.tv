import { InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { shots } from "./shots";

export const shotEmbeddings = pgTable("ShotEmbedding", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  shotId: uuid("shotId")
    .notNull()
    .references(() => shots.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ShotEmbedding = InferSelectModel<typeof shotEmbeddings>;

export const shotEmbeddingsByShotId = (shotId: string) =>
  eq(shotEmbeddings.shotId, shotId);
