import { embedMany } from "ai";
import { gateway } from "@ai-sdk/gateway";

const embeddingModel = gateway.textEmbeddingModel("openai/text-embedding-3-small");

export type ShotEmbeddingChunk = {
  content: string;
  embedding: number[];
};

export async function generateShotEmbeddings(
  text: string
): Promise<ShotEmbeddingChunk[]> {
  const chunks = text
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return [];
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });

  return embeddings.map((embedding, index) => ({
    content: chunks[index],
    embedding,
  }));
}
