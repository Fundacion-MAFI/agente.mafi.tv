import { gateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";

const openaiBaseURL = process.env.OPENAI_BASE_URL?.trim();

const openaiProvider = openaiBaseURL
  ? createOpenAI({
      baseURL: openaiBaseURL,
      apiKey: process.env.OPENAI_API_KEY?.trim(),
    })
  : null;

/**
 * Supported embedding models with their vector dimensions.
 * Models are keyed by provider/model format used by the AI Gateway.
 */
export const EMBEDDING_MODEL_REGISTRY = {
  "openai/text-embedding-3-small": { dimensions: 1536 },
  "openai/text-embedding-3-large": { dimensions: 3072 },
  "mistral/mistral-embed": { dimensions: 1024 },
  "google/gemini-embedding-001": { dimensions: 3072 },
  "google/text-multilingual-embedding-002": { dimensions: 768 },
  "google/text-embedding-005": { dimensions: 768 },
  "alibaba/qwen3-embedding-4b": { dimensions: 2560 },
  "amazon/titan-embed-text-v2": { dimensions: 1024 },
} as const;

export type EmbeddingModelId = keyof typeof EMBEDDING_MODEL_REGISTRY;

export const DEFAULT_EMBEDDING_MODEL: EmbeddingModelId =
  "openai/text-embedding-3-small";

export const EMBEDDING_MODEL_IDS = Object.keys(
  EMBEDDING_MODEL_REGISTRY
) as EmbeddingModelId[];

export function getEmbeddingDimensions(modelId: EmbeddingModelId): number {
  const config = EMBEDDING_MODEL_REGISTRY[modelId];
  if (!config) {
    throw new Error(`Unknown embedding model: ${modelId}`);
  }
  return config.dimensions;
}

export function getEmbeddingModel(modelId: EmbeddingModelId) {
  if (openaiProvider && modelId.startsWith("openai/")) {
    return openaiProvider.textEmbeddingModel(modelId.replace("openai/", ""));
  }
  return gateway.textEmbeddingModel(modelId);
}

export function isEmbeddingModelId(value: string): value is EmbeddingModelId {
  return value in EMBEDDING_MODEL_REGISTRY;
}
