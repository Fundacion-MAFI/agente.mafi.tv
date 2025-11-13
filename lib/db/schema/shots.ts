import { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const shots = pgTable("Shot", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  vimeoUrl: text("vimeoUrl").notNull(),
  date: text("date"),
  place: text("place"),
  author: text("author"),
  geotag: text("geotag"),
  tags: text("tags").array(),
  checksum: varchar("checksum", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Shot = InferSelectModel<typeof shots>;
