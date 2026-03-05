import "server-only";

import { count } from "drizzle-orm";
import postgres from "postgres";

import {
  getEmbeddingDimensions,
  isEmbeddingModelId,
} from "@/lib/ai/embedding-models";
import { getAdminSetting } from "./admin-settings";
import { db } from "./queries";
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
