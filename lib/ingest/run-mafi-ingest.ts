import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  type EmbeddingModelId,
  getEmbeddingDimensions,
  isEmbeddingModelId,
} from "@/lib/ai/embedding-models";
import { generateShotEmbeddings } from "@/lib/ai/mafi-embeddings";
import { embeddingModelMetadata } from "@/lib/db/schema/embedding-metadata";
import { SHOT_EMBEDDING_TABLES, shots } from "@/lib/db/schema/shots";
import type { Shot } from "@/lib/db/schema/shots";

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

function buildTextToEmbed(shot: Shot): string {
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

export type RunMafiIngestOptions = {
  prune?: boolean;
  connectionString?: string;
  onLog?: (line: string) => void;
};

export type RunMafiIngestResult = {
  ok: boolean;
  output: string;
  shotsProcessed: number;
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
      shotsProcessed: 0,
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
        shotsProcessed: 0,
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

    const allShots = await db.select().from(shots).orderBy(shots.slug);

    const dimensions = getEmbeddingDimensions(embeddingModel);
    const embeddingTable =
      SHOT_EMBEDDING_TABLES[dimensions as keyof typeof SHOT_EMBEDDING_TABLES];

    log(onLog, lines, "📼 Ingesting MAFI shots from database");
    log(onLog, lines, "   Embedding model:", embeddingModel);

    if (throttle) {
      log(onLog, lines, "⏱️  Throttling enabled:", delay, "ms delay");
    }

    let embeddingsUpdated = 0;

    for (let i = 0; i < allShots.length; i++) {
      const shot = allShots[i];
      log(onLog, lines, "📊", `${i + 1}/${allShots.length}`);
      const slug = shot.slug;

      let shouldUpdateEmbeddings = false;
      let updateReason: "no embeddings" | "timestamp check" = "no embeddings";

      if (embeddingTable) {
        const existingForModel = await db
          .select({
            createdAt: embeddingTable.createdAt,
          })
          .from(embeddingTable)
          .where(
            and(
              eq(embeddingTable.shotId, shot.id),
              eq(embeddingTable.modelId, embeddingModel)
            )
          )
          .limit(1);
        if (existingForModel.length === 0) {
          shouldUpdateEmbeddings = true;
          updateReason = "no embeddings";
        } else {
          const shotUpdatedAt = shot.updatedAt.getTime();
          const embeddingCreatedAt = (
            existingForModel[0] as { createdAt: Date }
          ).createdAt.getTime();
          if (shotUpdatedAt > embeddingCreatedAt) {
            shouldUpdateEmbeddings = true;
            updateReason = "timestamp check";
          }
        }
      } else {
        shouldUpdateEmbeddings = true;
      }

      if (!shouldUpdateEmbeddings) {
        log(onLog, lines, "⚪️ Shot", slug, "is up to date");
        continue;
      }

      if (updateReason === "timestamp check") {
        log(
          onLog,
          lines,
          "   → reason: shot.updated_at > embedding.created_at"
        );
      } else if (updateReason === "no embeddings") {
        log(onLog, lines, "   → reason: no embeddings for model", embeddingModel);
      }

      const textToEmbed = buildTextToEmbed(shot);
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
                eq(embeddingTable.shotId, shot.id),
                eq(embeddingTable.modelId, embeddingModel)
              )
            );
          if (embeddingChunks.length > 0) {
            await tx.insert(embeddingTable).values(
              embeddingChunks.map((chunk) => ({
                shotId: shot.id,
                content: chunk.content,
                embedding: chunk.embedding,
                modelId: embeddingModel,
              }))
            );
          }
        });
      }

      embeddingsUpdated += 1;
      log(onLog, lines, "✅ Updated embeddings for shot", slug, `(${updateReason})`);

      if (throttle && delay > 0) {
        await sleep(delay);
      }
    }

    const pruned = 0;
    if (prune) {
      log(onLog, lines, "⚠️ Prune is ignored (database is the single source of truth)");
    }

    log(
      onLog,
      lines,
      "🏁 Processed",
      allShots.length,
      "shots, refreshed embeddings for",
      embeddingsUpdated,
      "pruned",
      pruned
    );

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

    await sqlClient.end();

    return {
      ok: true,
      output: lines.join("\n"),
      shotsProcessed: allShots.length,
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
      shotsProcessed: 0,
      embeddingsUpdated: 0,
      pruned: 0,
      error: errMsg,
    };
  }
}
