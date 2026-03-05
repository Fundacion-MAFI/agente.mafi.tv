import "server-only";

import { count, eq } from "drizzle-orm";
import postgres from "postgres";

import {
  EMBEDDING_MODEL_IDS,
  type EmbeddingModelId,
  getEmbeddingDimensions,
  isEmbeddingModelId,
} from "@/lib/ai/embedding-models";
import { getAdminSetting } from "./admin-settings";
import { db } from "./queries";
import { embeddingModelMetadata } from "./schema/embedding-metadata";
import { shots } from "./schema/shots";

const EMBEDDING_TABLE_NAMES = [
  "shot_embeddings_768",
  "shot_embeddings_1024",
  "shot_embeddings_1536",
  "shot_embeddings_2560",
  "shot_embeddings_3072",
] as const;

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

export type EmbeddingsStatus = {
  activeModel: string;
  shotCount: number;
  embeddingCount: number;
  isReady: boolean;
};

export async function getEmbeddingsStatus(
  modelOverride?: string
): Promise<EmbeddingsStatus> {
  const rawModel = modelOverride ?? (await getAdminSetting("embedding.model"));
  const activeModel =
    typeof rawModel === "string" && isEmbeddingModelId(rawModel)
      ? rawModel
      : "openai/text-embedding-3-small";

  const [shotCountResult] = await db
    .select({ count: count(shots.id) })
    .from(shots);

  const shotCount = Number(shotCountResult?.count ?? 0);

  const dimensions = getEmbeddingDimensions(activeModel);
  const tableName = `shot_embeddings_${dimensions}`;

  if (
    !EMBEDDING_TABLE_NAMES.includes(
      tableName as (typeof EMBEDDING_TABLE_NAMES)[number]
    )
  ) {
    return {
      activeModel,
      shotCount,
      embeddingCount: 0,
      isReady: false,
    };
  }

  const sql = getSqlClient();
  const [row] = await sql.unsafe<[{ count: string }]>(
    `SELECT COUNT(DISTINCT shot_id)::text AS count FROM ${tableName} WHERE model_id = $1`,
    [activeModel]
  );

  const embeddingCount = Number(row?.count ?? 0);
  const isReady = shotCount > 0 && embeddingCount >= shotCount;

  return {
    activeModel,
    shotCount,
    embeddingCount,
    isReady,
  };
}

export type ModelStatus = {
  modelId: EmbeddingModelId;
  embeddingCount: number;
  isReady: boolean;
  chunkSize: number | null;
  chunkOverlap: number | null;
};

export type EmbeddingsStatusAll = {
  shotCount: number;
  activeModel: string;
  models: ModelStatus[];
};

export async function getEmbeddingsStatusAll(): Promise<EmbeddingsStatusAll> {
  const rawModel = await getAdminSetting("embedding.model");
  const activeModel =
    typeof rawModel === "string" && isEmbeddingModelId(rawModel)
      ? rawModel
      : "openai/text-embedding-3-small";

  const [shotCountResult] = await db
    .select({ count: count(shots.id) })
    .from(shots);
  const shotCount = Number(shotCountResult?.count ?? 0);

  const sql = getSqlClient();
  const models: ModelStatus[] = [];

  const metadataRows = await db.select().from(embeddingModelMetadata);
  const metadataByModel = new Map<
    string,
    { chunkSize: number; chunkOverlap: number }
  >();
  for (const row of metadataRows) {
    metadataByModel.set(row.modelId, {
      chunkSize: row.chunkSize,
      chunkOverlap: row.chunkOverlap,
    });
  }

  for (const modelId of EMBEDDING_MODEL_IDS) {
    const dimensions = getEmbeddingDimensions(modelId);
    const tableName = `shot_embeddings_${dimensions}`;

    if (
      !EMBEDDING_TABLE_NAMES.includes(
        tableName as (typeof EMBEDDING_TABLE_NAMES)[number]
      )
    ) {
      models.push({
        modelId,
        embeddingCount: 0,
        isReady: false,
        chunkSize: null,
        chunkOverlap: null,
      });
      continue;
    }

    const [row] = await sql.unsafe<[{ count: string }]>(
      `SELECT COUNT(DISTINCT shot_id)::text AS count FROM ${tableName} WHERE model_id = $1`,
      [modelId]
    );
    const embeddingCount = Number(row?.count ?? 0);
    const isReady = shotCount > 0 && embeddingCount >= shotCount;
    const meta = metadataByModel.get(modelId);
    models.push({
      modelId,
      embeddingCount,
      isReady,
      chunkSize: meta?.chunkSize ?? null,
      chunkOverlap: meta?.chunkOverlap ?? null,
    });
  }

  return { shotCount, activeModel, models };
}

export async function purgeEmbeddingsForModel(
  modelId: EmbeddingModelId
): Promise<{ deleted: number }> {
  const dimensions = getEmbeddingDimensions(modelId);
  const tableName = `shot_embeddings_${dimensions}`;

  if (
    !EMBEDDING_TABLE_NAMES.includes(
      tableName as (typeof EMBEDDING_TABLE_NAMES)[number]
    )
  ) {
    return { deleted: 0 };
  }

  const sql = getSqlClient();
  const [result] = await sql.unsafe<[{ count: string }]>(
    `WITH deleted AS (
       DELETE FROM ${tableName} WHERE model_id = $1
       RETURNING id
     )
     SELECT COUNT(*)::text AS count FROM deleted`,
    [modelId]
  );
  const deleted = Number(result?.count ?? 0);

  await db
    .delete(embeddingModelMetadata)
    .where(eq(embeddingModelMetadata.modelId, modelId));

  return { deleted };
}
