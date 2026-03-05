import type { InferSelectModel } from "drizzle-orm";
import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const adminSettings = pgTable("admin_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminSetting = InferSelectModel<typeof adminSettings>;
