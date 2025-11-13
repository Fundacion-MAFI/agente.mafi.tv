import { createDocumentHandler } from "@/lib/artifacts/handlers";

export const mafiPlaylistDocumentHandler = createDocumentHandler({
  kind: "mafi-playlist",
  async onCreateDocument({ title }) {
    return JSON.stringify({
      title,
      shots: [],
      generalComment: "",
      followUpSuggestions: [],
      question: "",
    });
  },
  async onUpdateDocument({ document }) {
    return document.content ?? "{}";
  },
});
