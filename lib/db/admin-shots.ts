import "server-only";

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  EMBEDDING_MODEL_IDS,
  type EmbeddingModelId,
  getEmbeddingDimensions,
} from "@/lib/ai/embedding-models";
import { generateShotEmbeddingsForAllModels } from "@/lib/ai/mafi-embeddings";
import { SHOT_EMBEDDING_TABLES, type Shot, shots } from "@/lib/db/schema/shots";
import { db } from "./queries";

export type ShotInsert = Omit<Shot, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function buildTextToEmbed(shot: {
  title: string;
  description: string | null;
  historicContext: string | null;
  place: string | null;
  author: string | null;
  date: string | null;
  geotag: string | null;
  tags: string[];
}): string {
  return [
    shot.title,
    shot.description,
    shot.historicContext,
    shot.place,
    shot.author,
    shot.date,
    shot.geotag,
    shot.tags.join(", "),
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export async function listShots(options?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<Shot[]> {
  const { limit = 50, offset = 0 } = options ?? {};
  const result = await db
    .select()
    .from(shots)
    .orderBy(shots.slug)
    .limit(limit)
    .offset(offset);
  return result;
}

export async function getShotBySlug(slug: string): Promise<Shot | null> {
  const [shot] = await db
    .select()
    .from(shots)
    .where(eq(shots.slug, slug))
    .limit(1);
  return shot ?? null;
}

export async function upsertShotWithEmbeddings(
  data: Omit<ShotInsert, "checksum"> & { checksum?: string }
): Promise<Shot> {
  const content = buildMarkdownFromShot(data);
  const checksum = data.checksum ?? sha256(content);
  const now = new Date();

  const fields = {
    slug: data.slug,
    title: data.title,
    description: data.description ?? null,
    historicContext: data.historicContext ?? null,
    vimeoUrl: data.vimeoUrl ?? null,
    date: data.date ?? null,
    place: data.place ?? null,
    author: data.author ?? null,
    geotag: data.geotag ?? null,
    tags: data.tags ?? [],
    checksum,
    updatedAt: now,
  };

  const [upserted] = await db
    .insert(shots)
    .values(fields)
    .onConflictDoUpdate({ target: shots.slug, set: fields })
    .returning();

  const textToEmbed = buildTextToEmbed(upserted);
  const modelChunks = await generateShotEmbeddingsForAllModels(textToEmbed);

  await db.transaction(async (tx) => {
    for (const table of Object.values(SHOT_EMBEDDING_TABLES)) {
      await tx.delete(table).where(eq(table.shotId, upserted.id));
    }

    for (const modelId of EMBEDDING_MODEL_IDS) {
      const chunks = modelChunks[modelId];
      if (!chunks?.length) continue;

      const dimensions = getEmbeddingDimensions(modelId);
      const table =
        SHOT_EMBEDDING_TABLES[dimensions as keyof typeof SHOT_EMBEDDING_TABLES];
      if (!table) continue;

      await tx.insert(table).values(
        chunks.map((chunk) => ({
          shotId: upserted.id,
          content: chunk.content,
          embedding: chunk.embedding,
          modelId,
        }))
      );
    }
  });

  return upserted;
}

export async function deleteShotBySlug(slug: string): Promise<Shot | null> {
  const [shot] = await db
    .select()
    .from(shots)
    .where(eq(shots.slug, slug))
    .limit(1);
  if (!shot) {
    return null;
  }

  await db.delete(shots).where(eq(shots.slug, slug));
  return shot;
}

function buildMarkdownFromShot(shot: {
  title: string;
  description?: string | null;
  historicContext?: string | null;
  vimeoUrl?: string | null;
  date?: string | null;
  place?: string | null;
  author?: string | null;
  geotag?: string | null;
  tags?: string[];
}): string {
  const tags = shot.tags ?? [];
  const frontmatter: Record<string, string | string[] | undefined> = {
    title: shot.title,
    vimeo_link: shot.vimeoUrl ?? undefined,
    date: shot.date ?? undefined,
    geotag: shot.geotag ?? undefined,
    place: shot.place ?? undefined,
    author: shot.author ?? undefined,
    description: shot.description ?? undefined,
    historic_context: shot.historicContext ?? undefined,
    tags: tags.length > 0 ? tags : undefined,
  };

  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(
        `${key}: [${value.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(", ")}]`
      );
    } else {
      const escaped = String(value).replace(/"/g, '\\"');
      lines.push(`${key}: "${escaped}"`);
    }
  }
  lines.push("---");
  lines.push("");
  if (shot.description) {
    lines.push(shot.description);
    lines.push("");
  }
  return lines.join("\n");
}
