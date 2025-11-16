import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";

export const mafiPlaylistArtifact = new Artifact<"mafi-playlist">({
  kind: "mafi-playlist",
  description: "Curated selections from Archivo MAFI.",
  initialize: async () => undefined,
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-textDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: `${draftArtifact.content}${streamPart.data}`,
        status: "streaming",
        isVisible:
          draftArtifact.isVisible ||
          draftArtifact.content.length + streamPart.data.length > 0,
      }));
    }
  },
  content: ({ content, isLoading }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="mafi-playlist" />;
    }

    return (
      <div className="flex w-full flex-col gap-6 px-4 py-8 md:p-20">
        <p className="text-sm text-muted-foreground">
          Selección generada automáticamente por Agente Fílmico con base en tu consigna.
        </p>
        <article className="prose prose-sm max-w-none whitespace-pre-wrap text-base dark:prose-invert">
          {content}
        </article>
      </div>
    );
  },
  actions: [],
  toolbar: [],
});
