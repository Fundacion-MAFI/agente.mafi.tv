import type { LanguageModel } from "ai";

const createMockModel = (modelId: string): LanguageModel => {
  return {
    specificationVersion: "v2",
    provider: "mock",
    modelId,
    defaultObjectGenerationMode: "tool",
    supportedUrls: [],
    supportsImageUrls: false,
    supportsStructuredOutputs: false,
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: "text", text: "Hello, world!" }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: "text-delta",
            id: "mock-id",
            delta: "Mock response",
          });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  } as unknown as LanguageModel;
};

export const chatModel = createMockModel("chat-model");
export const reasoningModel = createMockModel("chat-model-reasoning");
export const titleModel = createMockModel("title-model");
export const artifactModel = createMockModel("artifact-model");
export const filmAgentModel = createMockModel("film-agent");
