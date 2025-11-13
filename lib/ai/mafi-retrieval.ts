import { embed } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { shotEmbeddings, shots } from "@/lib/db/schema";

const embeddingModel = gateway.textEmbeddingModel("openai/text-embedding-3-small");

export type MafiShotContext = {
  id: string;
  slug: string;
  title: string;
  description: string;
  vimeoUrl: string;
  date?: string | null;
  place?: string | null;
  author?: string | null;
  geotag?: string | null;
  tags?: string[] | null;
  similarity: number;
};

export async function retrieveRelevantShots(
  query: string,
  opts?: { limit?: number }
): Promise<MafiShotContext[]> {
  const limit = opts?.limit ?? 12;
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const { embedding } = await embed({
    model: embeddingModel,
    value: normalizedQuery,
  });

  const embeddingVector = embedding;

  const rows = await db
    .select({
      shotId: shotEmbeddings.shotId,
      id: shots.id,
      slug: shots.slug,
      title: shots.title,
      description: shots.description,
      vimeoUrl: shots.vimeoUrl,
      date: shots.date,
      place: shots.place,
      author: shots.author,
      geotag: shots.geotag,
      tags: shots.tags,
      similarity: sql<number>`1 - (${shotEmbeddings.embedding} <=> ${embeddingVector})`,
    })
    .from(shotEmbeddings)
    .innerJoin(shots, eq(shotEmbeddings.shotId, shots.id))
    .orderBy(sql`${shotEmbeddings.embedding} <=> ${embeddingVector}`)
    .limit(Math.max(limit * 4, limit));

  const byShot = new Map<string, MafiShotContext>();

  for (const row of rows) {
    const current = byShot.get(row.shotId);
    const similarity = Number(row.similarity);

    if (!current || similarity > current.similarity) {
      byShot.set(row.shotId, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        vimeoUrl: row.vimeoUrl,
        date: row.date,
        place: row.place,
        author: row.author,
        geotag: row.geotag,
        tags: row.tags,
        similarity,
      });
    }
  }

  return Array.from(byShot.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
