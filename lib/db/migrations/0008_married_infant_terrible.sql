CREATE EXTENSION IF NOT EXISTS "vector";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shot_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "shot_id" uuid NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(128) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"vimeo_url" text,
	"date" text,
	"place" text,
	"author" text,
	"geotag" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shot_embeddings" ADD CONSTRAINT "shot_embeddings_shot_id_shots_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."shots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shot_embeddings_shot_id_idx" ON "shot_embeddings" USING btree ("shot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shot_embeddings_embedding_cosine_idx" ON "shot_embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shots_slug_unique" ON "shots" USING btree ("slug");