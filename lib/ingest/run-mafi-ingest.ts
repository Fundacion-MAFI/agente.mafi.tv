import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import matter from "gray-matter";
import postgres from "postgres";

import {
  type EmbeddingModelId,
  getEmbeddingDimensions,
  isEmbeddingModelId,
} from "@/lib/ai/embedding-models";
import { generateShotEmbeddings } from "@/lib/ai/mafi-embeddings";
import { embeddingModelMetadata } from "@/lib/db/schema/embedding-metadata";
import { SHOT_EMBEDDING_TABLES, shots } from "@/lib/db/schema/shots";

const INGEST_DEFAULTS = {
  throttleEnabled: true,
  throttleDelayMs: 10_000,
  chunkSize: 800,
  chunkOverlap: 200,
  embeddingModel: "openai/text-embedding-3-small" as EmbeddingModelId,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ShotFrontMatter = {
  title?: string;
  description?: string;
  historic_context?: string;
  vimeo_link?: string;
  date?: string;
  place?: string;
  author?: string;
  geotag?: string;
  tags?: string[] | string;
};

export type RunMafiIngestOptions = {
  prune?: boolean;
  dataDirectory?: string;
  connectionString?: string;
  onLog?: (line: string) => void;
};

export type RunMafiIngestResult = {
  ok: boolean;
  output: string;
  filesProcessed: number;
  embeddingsUpdated: number;
  pruned: number;
  error?: string;
};

function log(
  onLog: ((line: string) => void) | undefined,
  lines: string[],
  ...args: unknown[]
) {
  const line = args.map((a) => String(a)).join(" ");
  lines.push(line);
  onLog?.(line);
}

export async function runMafiIngest(
  options: RunMafiIngestOptions = {}
): Promise<RunMafiIngestResult> {
  const {
    prune = false,
    dataDirectory = path.join(process.cwd(), "data", "mafi-shots"),
    connectionString = process.env.POSTGRES_URL_NON_POOLING ??
      process.env.POSTGRES_URL,
    onLog,
  } = options;

  const lines: string[] = [];

  if (!connectionString) {
    const err = "POSTGRES_URL or POSTGRES_URL_NON_POOLING must be defined";
    log(onLog, lines, "❌", err);
    return {
      ok: false,
      output: lines.join("\n"),
      filesProcessed: 0,
      embeddingsUpdated: 0,
      pruned: 0,
      error: err,
    };
  }

  const sqlClient = postgres(connectionString, { max: 1 });
  const db = drizzle(sqlClient);

  try {
    const [schemaResult] = (await sqlClient`
      SELECT
        to_regclass('public.shots') AS shots,
        to_regclass('public.shot_embeddings_1536') AS "shotEmbeddings1536"
    `) as { shots: string | null; shotEmbeddings1536: string | null }[];

    if (!schemaResult?.shots || !schemaResult?.shotEmbeddings1536) {
      const err = "Missing tables. Run pnpm db:migrate first.";
      log(onLog, lines, "⚠️", err);
      return {
        ok: false,
        output: lines.join("\n"),
        filesProcessed: 0,
        embeddingsUpdated: 0,
        pruned: 0,
        error: err,
      };
    }

    const rows = await sqlClient`
      SELECT key, value FROM admin_settings
      WHERE key IN (
        'ingest.throttle_enabled',
        'ingest.throttle_delay_ms',
        'embedding.chunk_size',
        'embedding.chunk_overlap',
        'embedding.model'
      )
    `;

    const map = Object.fromEntries(
      (rows as unknown as { key: string; value: unknown }[]).map((r) => [
        r.key,
        r.value,
      ])
    );

    const rawModel = map["embedding.model"];
    const embeddingModel: EmbeddingModelId =
      typeof rawModel === "string" &&
      rawModel.trim().length > 0 &&
      isEmbeddingModelId(rawModel.trim())
        ? (rawModel.trim() as EmbeddingModelId)
        : INGEST_DEFAULTS.embeddingModel;

    const throttle =
      map["ingest.throttle_enabled"] !== false ||
      process.env.INGEST_THROTTLE_EMBEDDINGS === "1" ||
      process.env.INGEST_THROTTLE_EMBEDDINGS === "true" ||
      process.env.INGEST_THROTTLE_EMBEDDINGS === "yes";
    const delay =
      typeof map["ingest.throttle_delay_ms"] === "number" &&
      map["ingest.throttle_delay_ms"] >= 0
        ? (map["ingest.throttle_delay_ms"] as number)
        : INGEST_DEFAULTS.throttleDelayMs;
    const chunkSize =
      typeof map["embedding.chunk_size"] === "number" &&
      map["embedding.chunk_size"] > 0
        ? (map["embedding.chunk_size"] as number)
        : 800;
    const chunkOverlap =
      typeof map["embedding.chunk_overlap"] === "number" &&
      map["embedding.chunk_overlap"] >= 0
        ? (map["embedding.chunk_overlap"] as number)
        : 200;

    let files: string[];
    try {
      const dirFiles = await fs.readdir(dataDirectory);
      files = dirFiles.filter((f) => f.endsWith(".md")).sort();
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to read data directory";
      log(onLog, lines, "❌", errMsg);
      return {
        ok: false,
        output: lines.join("\n"),
        filesProcessed: 0,
        embeddingsUpdated: 0,
        pruned: 0,
        error: errMsg,
      };
    }

    const dimensions = getEmbeddingDimensions(embeddingModel);
    const embeddingTable =
      SHOT_EMBEDDING_TABLES[dimensions as keyof typeof SHOT_EMBEDDING_TABLES];

    log(onLog, lines, "📼 Ingesting MAFI shots from", dataDirectory);
    log(onLog, lines, "   Embedding model:", embeddingModel);

    if (throttle) {
      log(onLog, lines, "⏱️  Throttling enabled:", delay, "ms delay");
    }

    const processedSlugs = new Set<string>();
    let embeddingsUpdated = 0;

    function sha256(content: string) {
      return crypto.createHash("sha256").update(content).digest("hex");
    }

    function normalizeTags(raw: ShotFrontMatter["tags"]): string[] {
      if (!raw) return [];
      if (Array.isArray(raw)) {
        return raw.map((tag) => tag.trim()).filter(Boolean);
      }
      return raw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      log(onLog, lines, "📊", `${i + 1}/${files.length}`);
      const slug = path.basename(file, path.extname(file));
      processedSlugs.add(slug);

      const fullPath = path.join(dataDirectory, file);
      const fileContent = await fs.readFile(fullPath, "utf8");
      const checksum = sha256(fileContent);
      const { data, content } = matter(fileContent);
      const metadata = data as ShotFrontMatter;
      const tags = normalizeTags(metadata.tags);
      const contentBody = content.trim();
      const description = metadata.description ?? (contentBody || null);
      const fields = {
        slug,
        title: metadata.title ?? slug,
        description,
        historicContext: metadata.historic_context ?? null,
        vimeoUrl: metadata.vimeo_link ?? null,
        date: metadata.date ?? null,
        place: metadata.place ?? null,
        author: metadata.author ?? null,
        geotag: metadata.geotag ?? null,
        tags,
        checksum,
        updatedAt: new Date(),
      } satisfies typeof shots.$inferInsert;

      const existing = await db
        .select({ id: shots.id, checksum: shots.checksum })
        .from(shots)
        .where(eq(shots.slug, slug))
        .limit(1);

      const [upserted] = await db
        .insert(shots)
        .values({ ...fields })
        .onConflictDoUpdate({ target: shots.slug, set: fields })
        .returning({ id: shots.id });

      let shouldUpdateEmbeddings =
        existing.length === 0 || existing[0].checksum !== checksum;

      if (!shouldUpdateEmbeddings && embeddingTable) {
        const existingForModel = await db
          .select()
          .from(embeddingTable)
          .where(
            and(
              eq(embeddingTable.shotId, upserted.id),
              eq(embeddingTable.modelId, embeddingModel)
            )
          )
          .limit(1);
        if (existingForModel.length === 0) {
          shouldUpdateEmbeddings = true;
        }
      }

      if (!shouldUpdateEmbeddings) {
        log(onLog, lines, "⚪️ Shot", slug, "is up to date");
        continue;
      }

      const textToEmbed = [
        metadata.title,
        metadata.description,
        metadata.historic_context,
        metadata.place,
        metadata.author,
        metadata.date,
        metadata.geotag,
        tags.join(", "),
        contentBody,
      ]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join("\n\n");

      const embeddingChunks = await generateShotEmbeddings(textToEmbed, {
        chunkSize,
        chunkOverlap,
        modelId: embeddingModel,
      });

      if (embeddingTable) {
        await db.transaction(async (tx) => {
          await tx
            .delete(embeddingTable)
            .where(
              and(
                eq(embeddingTable.shotId, upserted.id),
                eq(embeddingTable.modelId, embeddingModel)
              )
            );
          if (embeddingChunks.length > 0) {
            await tx.insert(embeddingTable).values(
              embeddingChunks.map((chunk) => ({
                shotId: upserted.id,
                content: chunk.content,
                embedding: chunk.embedding,
                modelId: embeddingModel,
              }))
            );
          }
        });
      }

      embeddingsUpdated += 1;
      log(onLog, lines, "✅ Updated embeddings for shot", slug);

      if (throttle && delay > 0) {
        await sleep(delay);
      }
    }

    let pruned = 0;
    if (prune) {
      const existing = await db.select({ slug: shots.slug }).from(shots);
      const toDelete = existing
        .map((r) => r.slug)
        .filter((s) => !processedSlugs.has(s));
      if (toDelete.length > 0) {
        await db.delete(shots).where(inArray(shots.slug, toDelete));
        pruned = toDelete.length;
      }
    }

    log(
      onLog,
      lines,
      "🏁 Processed",
      files.length,
      "shots, refreshed embeddings for",
      embeddingsUpdated,
      "pruned",
      pruned
    );

    if (embeddingsUpdated > 0) {
      await db
        .insert(embeddingModelMetadata)
        .values({
          modelId: embeddingModel,
          chunkSize: chunkSize,
          chunkOverlap: chunkOverlap,
          embeddedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: embeddingModelMetadata.modelId,
          set: {
            chunkSize: chunkSize,
            chunkOverlap: chunkOverlap,
            embeddedAt: new Date(),
          },
        });
    }

    await sqlClient.end();

    return {
      ok: true,
      output: lines.join("\n"),
      filesProcessed: files.length,
      embeddingsUpdated,
      pruned,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(onLog, lines, "❌ Failed to ingest MAFI shots");
    log(onLog, lines, errMsg);
    await sqlClient.end();
    return {
      ok: false,
      output: lines.join("\n"),
      filesProcessed: 0,
      embeddingsUpdated: 0,
      pruned: 0,
      error: errMsg,
    };
  }
}
