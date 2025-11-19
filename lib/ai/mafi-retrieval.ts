import "server-only";

import { embedMany } from "ai";
import { gateway } from "@ai-sdk/gateway";
import postgres from "postgres";

import type { Shot } from "@/lib/db/schema";

export type RetrievedShot = Shot & {
  chunkContent: string;
  similarity: number;
};

const DEFAULT_RETRIEVAL_K = 24;
const MAX_RESULT_LIMIT = 50;
const DEFAULT_RETRIEVAL_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 128;
const embeddingModel = gateway.textEmbeddingModel("openai/text-embedding-3-small");

let sqlClient: ReturnType<typeof postgres> | null = null;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const embeddingCache = new Map<string, CacheEntry<number[]>>();
const retrievalCache = new Map<string, CacheEntry<RetrievedShot[]>>();

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

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;

  if (cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const [oldestKey] = cache.keys();
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
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

export class ArchivoTimeoutError extends Error {
  readonly context: string;
  readonly timeoutMs: number;
  readonly reason: "timeout" | "aborted";

  constructor({
    context,
    timeoutMs,
    reason,
  }: {
    context: string;
    timeoutMs: number;
    reason: "timeout" | "aborted";
  }) {
    super(
      reason === "timeout"
        ? `Archivo retrieval timed out while ${context} after ${timeoutMs}ms`
        : `Archivo retrieval aborted while ${context}`,
    );
    this.name = "ArchivoTimeoutError";
    this.context = context;
    this.timeoutMs = timeoutMs;
    this.reason = reason;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  {
    context,
    timeoutMs,
    signal,
  }: {
    context: string;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    const onAbort = () => {
      cleanup();
      const abortReason =
        signal?.reason instanceof ArchivoTimeoutError
          ? signal.reason
          : new ArchivoTimeoutError({ context, timeoutMs, reason: "aborted" });
      reject(abortReason);
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new ArchivoTimeoutError({ context, timeoutMs, reason: "timeout" }));
    }, timeoutMs);

    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export async function retrieveRelevantShots(
  query: string,
  {
    limit = DEFAULT_RETRIEVAL_K,
    signal,
    timeoutMs = DEFAULT_RETRIEVAL_TIMEOUT_MS,
  }: { limit?: number; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<RetrievedShot[]> {
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  if (!normalizedQuery) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(limit, MAX_RESULT_LIMIT));
  const retrievalCacheKey = `${safeLimit}:${normalizedQuery}`;
  const cachedShots = getCachedValue(retrievalCache, retrievalCacheKey);
  if (cachedShots) {
    return cachedShots.map((shot) => ({ ...shot }));
  }

  const cachedEmbedding = getCachedValue(embeddingCache, normalizedQuery);
  const embeddingResult = cachedEmbedding
    ? null
    : await withTimeout(
        embedMany({
          model: embeddingModel,
          values: [normalizedQuery],
          abortSignal: signal,
        }),
        {
          context: "embedding Archivo query",
          timeoutMs,
          signal,
        },
      );

  const [queryEmbedding] = cachedEmbedding
    ? [cachedEmbedding]
    : embeddingResult?.embeddings ?? [];
  if (!queryEmbedding?.length) {
    return [];
  }

  if (!cachedEmbedding) {
    setCachedValue(embeddingCache, normalizedQuery, queryEmbedding);
  }

  const vectorLiteral = buildVectorLiteral(queryEmbedding);
  const sql = getSqlClient();
  const rows = await withTimeout(
    sql<RetrievedShotRow[]>`
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
        1 - (se.embedding <=> ${vectorLiteral}::vector) AS "similarity"
      FROM shot_embeddings se
      JOIN shots s ON s.id = se.shot_id
      ORDER BY se.embedding <=> ${vectorLiteral}::vector
      LIMIT ${safeLimit}
    `,
    {
      context: "querying Archivo vectors",
      timeoutMs,
      signal,
    },
  );

  const shots = rows.map((row) => ({
    ...row,
    similarity: Number(row.similarity),
  }));

  setCachedValue(
    retrievalCache,
    retrievalCacheKey,
    shots.map((shot) => ({ ...shot })),
  );

  return shots;
}
