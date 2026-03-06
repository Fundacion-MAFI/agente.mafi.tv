import "server-only";

import { and, eq } from "drizzle-orm";
import {
  type EmbeddingModelId,
  getEmbeddingDimensions,
  isEmbeddingModelId,
} from "@/lib/ai/embedding-models";
import { generateShotEmbeddings } from "@/lib/ai/mafi-embeddings";
import { SHOT_EMBEDDING_TABLES, type Shot, shots } from "@/lib/db/schema/shots";
import { getAdminSetting } from "./admin-settings";
import { db } from "./queries";

export type ShotInsert = Omit<Shot, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

import { computeShotChecksum } from "./shot-checksum";

function buildTextToEmbed(shot: {
  title: string;
  description: string | null;
  historicContext: string | null;
  aestheticCriticalCommentary: string | null;
  productionCommentary: string | null;
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
    shot.aestheticCriticalCommentary,
    shot.productionCommentary,
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
): Promise<{ shot: Shot; modelId: string }> {
  const checksum = data.checksum ?? computeShotChecksum(data);
  const now = new Date();

  const fields = {
    slug: data.slug,
    title: data.title,
    description: data.description ?? null,
    historicContext: data.historicContext ?? null,
    aestheticCriticalCommentary: data.aestheticCriticalCommentary ?? null,
    productionCommentary: data.productionCommentary ?? null,
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

  const rawModel = await getAdminSetting("embedding.model");
  const modelId: EmbeddingModelId =
    typeof rawModel === "string" && isEmbeddingModelId(rawModel)
      ? rawModel
      : "openai/text-embedding-3-small";

  const textToEmbed = buildTextToEmbed(upserted);
  const embeddingChunks = await generateShotEmbeddings(textToEmbed, {
    modelId,
  });

  const dimensions = getEmbeddingDimensions(modelId);
  const table =
    SHOT_EMBEDDING_TABLES[dimensions as keyof typeof SHOT_EMBEDDING_TABLES];

  if (table && embeddingChunks.length > 0) {
    await db.transaction(async (tx) => {
      await tx
        .delete(table)
        .where(and(eq(table.shotId, upserted.id), eq(table.modelId, modelId)));
      await tx.insert(table).values(
        embeddingChunks.map((chunk) => ({
          shotId: upserted.id,
          content: chunk.content,
          embedding: chunk.embedding,
          modelId,
        }))
      );
    });
  }

  return { shot: upserted, modelId };
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
