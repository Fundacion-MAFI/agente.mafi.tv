CREATE EXTENSION IF NOT EXISTS "vector";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Shot" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" varchar(255) NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "vimeoUrl" text NOT NULL,
        "date" text,
        "place" text,
        "author" text,
        "geotag" text,
        "tags" text[],
        "checksum" varchar(64) NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Shot_slug_unique" ON "Shot" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ShotEmbedding" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "shotId" uuid NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ShotEmbedding" ADD CONSTRAINT "ShotEmbedding_shotId_Shot_id_fk" FOREIGN KEY ("shotId") REFERENCES "public"."Shot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ShotEmbedding_shotId_index" ON "ShotEmbedding" ("shotId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ShotEmbedding_embedding_vector_index" ON "ShotEmbedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
