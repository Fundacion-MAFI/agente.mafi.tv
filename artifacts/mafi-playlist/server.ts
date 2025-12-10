import { createDocumentHandler } from "@/lib/artifacts/server";

export const mafiPlaylistDocumentHandler =
  createDocumentHandler<"mafi-playlist">({
    kind: "mafi-playlist",
    // biome-ignore lint/suspicious/useAwait: interface match
    onCreateDocument: async () => {
      // Content is streamed directly from the Agente Fílmico workflow.
      // Persist whatever was sent from the client without additional generation.
      return "";
    },
    // biome-ignore lint/suspicious/useAwait: interface match
    onUpdateDocument: async ({ document }) => {
      return document.content ?? "";
    },
  });
