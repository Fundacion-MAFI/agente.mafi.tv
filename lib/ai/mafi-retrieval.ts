import "server-only";

import { embedMany } from "ai";
import postgres from "postgres";

import type { Shot } from "@/lib/db/schema";

export type RetrievedShot = Shot & {
  chunkContent: string;
  similarity: number;
};

const DEFAULT_RESULT_LIMIT = 12;
const MAX_RESULT_LIMIT = 50;
const EMBEDDING_MODEL = "text-embedding-3-small";

let sqlClient: ReturnType<typeof postgres> | null = null;

function getSqlClient() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  if (!sqlClient) {
    sqlClient = postgres(process.env.POSTGRES_URL, { max: 1 });
  }

  return sqlClient;
}

function buildVectorLiteral(embedding: number[]): string {
  const formatted = embedding.map((value) => Number(value).toFixed(6));
  return `[${formatted.join(",")}]`;
}

type RetrievedShotRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  vimeoUrl: string | null;
  date: string | null;
  place: string | null;
  author: string | null;
  geotag: string | null;
  tags: string[];
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
  chunkContent: string;
  similarity: number;
};

export async function retrieveRelevantShots(
  query: string,
  { limit = DEFAULT_RESULT_LIMIT }: { limit?: number } = {}
): Promise<RetrievedShot[]> {
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  if (!normalizedQuery) {
    return [];
  }

  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: [normalizedQuery],
  });

  const [queryEmbedding] = embeddings ?? [];
  if (!queryEmbedding?.length) {
    return [];
  }

  const vectorLiteral = buildVectorLiteral(queryEmbedding);
  const safeLimit = Math.max(1, Math.min(limit, MAX_RESULT_LIMIT));

  const rows = await getSqlClient().unsafe<RetrievedShotRow[]>(
    `
    SELECT
      s.id,
      s.slug,
      s.title,
      s.description,
      s.vimeo_url AS "vimeoUrl",
      s.date,
      s.place,
      s.author,
      s.geotag,
      s.tags,
      s.checksum,
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt",
      se.content AS "chunkContent",
      1 - (se.embedding <=> '${vectorLiteral}'::vector) AS "similarity"
    FROM shot_embeddings se
    JOIN shots s ON s.id = se.shot_id
    ORDER BY se.embedding <=> '${vectorLiteral}'::vector
    LIMIT ${safeLimit}
  `
  );

  return rows.map((row) => ({
    ...row,
    similarity: Number(row.similarity),
  }));
}
