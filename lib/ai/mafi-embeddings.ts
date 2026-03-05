import { embedMany } from "ai";
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_MODEL_IDS,
  type EmbeddingModelId,
  getEmbeddingDimensions,
  getEmbeddingModel,
  isEmbeddingModelId,
} from "@/lib/ai/embedding-models";

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 200;

export type ShotEmbeddingChunk = {
  content: string;
  embedding: number[];
};

const PARAGRAPH_SPLITTER = /\n{2,}/;

export function chunkShotText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  chunkOverlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  if (chunkSize <= chunkOverlap) {
    throw new Error("chunkSize must be greater than chunkOverlap");
  }

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(PARAGRAPH_SPLITTER)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= chunkSize) {
      chunks.push(paragraph);
      continue;
    }

    let start = 0;
    while (start < paragraph.length) {
      const end = Math.min(start + chunkSize, paragraph.length);
      const chunk = paragraph.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      if (end === paragraph.length) {
        break;
      }
      start += chunkSize - chunkOverlap;
    }
  }

  return chunks;
}

export async function generateShotEmbeddings(
  text: string,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    modelId?: EmbeddingModelId;
  }
): Promise<ShotEmbeddingChunk[]> {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return [];
  }

  const modelId = options?.modelId ?? DEFAULT_EMBEDDING_MODEL;
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  const chunks = chunkShotText(trimmed, chunkSize, chunkOverlap);

  if (chunks.length === 0) {
    return [];
  }

  const model = getEmbeddingModel(modelId);
  const { embeddings } = await embedMany({
    model,
    values: chunks,
  });

  return embeddings.map((embedding, index) => ({
    content: chunks[index],
    embedding,
  }));
}

export type ModelEmbeddingChunks = Record<
  EmbeddingModelId,
  ShotEmbeddingChunk[]
>;

/**
 * Generate embeddings for all supported models. Used during ingest for
 * multi-model support (instant switching in admin).
 */
export async function generateShotEmbeddingsForAllModels(
  text: string,
  options?: { chunkSize?: number; chunkOverlap?: number }
): Promise<ModelEmbeddingChunks> {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return {} as ModelEmbeddingChunks;
  }

  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  const chunks = chunkShotText(trimmed, chunkSize, chunkOverlap);

  if (chunks.length === 0) {
    return {} as ModelEmbeddingChunks;
  }

  const result = {} as ModelEmbeddingChunks;

  for (const modelId of EMBEDDING_MODEL_IDS) {
    const model = getEmbeddingModel(modelId);
    const { embeddings } = await embedMany({
      model,
      values: chunks,
    });
    result[modelId] = embeddings.map((embedding, index) => ({
      content: chunks[index],
      embedding,
    }));
  }

  return result;
}
