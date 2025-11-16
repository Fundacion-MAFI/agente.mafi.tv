import { createDocumentHandler } from "@/lib/artifacts/server";

export const mafiPlaylistDocumentHandler = createDocumentHandler<"mafi-playlist">({
  kind: "mafi-playlist",
  onCreateDocument: async () => {
    // Content is streamed directly from the Agente Fílmico workflow.
    // Persist whatever was sent from the client without additional generation.
    return "";
  },
  onUpdateDocument: async ({ document }) => {
    return document.content ?? "";
  },
});
