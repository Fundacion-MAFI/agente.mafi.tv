import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import type { MafiPlaylistDocumentEntry } from "@/lib/artifacts/mafi-playlist";
import { safeParseMafiPlaylistDocument } from "@/lib/artifacts/mafi-playlist";
import Player from "@vimeo/player";
import { useInView } from "framer-motion";
import { useEffect, useRef } from "react";

function formatStartLabel(entry: MafiPlaylistDocumentEntry): string | undefined {
  if (entry.startTimeLabel?.trim()) {
    return entry.startTimeLabel;
  }

  if (typeof entry.startTimeSeconds === "number") {
    const seconds = Math.max(0, Math.floor(entry.startTimeSeconds));
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [hrs, mins, secs]
      .filter((value, index) => value > 0 || index > 0)
      .map((value) => value.toString().padStart(2, "0"));

    if (parts.length === 0) {
      return "00:00";
    }

    return parts.join(":");
  }

  return undefined;
}

function VimeoPlayer({
  videoId,
  title,
  startTime,
}: {
  videoId: string;
  title: string;
  startTime?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);
  const isInView = useInView(containerRef, { amount: 0.5 });

  useEffect(() => {
    if (!iframeRef.current) return;

    const player = new Player(iframeRef.current);
    playerRef.current = player;

    return () => {
      player.unload();
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isInView) {
      player.getPaused().then((paused: boolean) => {
        if (paused) {
          player.getCurrentTime().then((seconds: number) => {
            // If the video is at the beginning (less than 1s played), seek to start time
            if (seconds < 1) {
              const start = startTime ?? 4;
              player
                .setCurrentTime(start)
                .then(() => player.play())
                .catch(() => player.play());
            } else {
              player.play().catch(() => {});
            }
          });
        }
      });
    } else {
      player.getPaused().then((paused: boolean) => {
        if (!paused) {
          player.pause().catch(() => {});
        }
      });
    }
  }, [isInView, startTime]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <iframe
        ref={iframeRef}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
        loading="lazy"
        src={`https://player.vimeo.com/video/${videoId}`}
        title={title}
      />
    </div>
  );
}

function PlaylistEntry({
  entry,
  index,
}: {
  entry: MafiPlaylistDocumentEntry;
  index: number;
}) {
  const startLabel = formatStartLabel(entry);

  const metadata: { label: string; value: string | undefined }[] = [
    { label: "Autoría", value: entry.author ?? undefined },
    { label: "Fecha", value: entry.date ?? undefined },
    // { label: "Lugar", value: entry.place ?? undefined },
    // { label: "Slug", value: entry.slug },
  ].filter((item) => Boolean(item.value));

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-background/60 p-4 shadow-sm sm:p-6">
      {/* <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plano {String(index + 1).padStart(2, "0")}
        </span>
        {startLabel ? (
          <span className="text-xs text-muted-foreground">
            Inicio sugerido: <strong>{startLabel}</strong>
          </span>
        ) : null}
      </div> */}

      <div className="aspect-video w-full overflow-hidden rounded-2xl border bg-black">
        {entry.vimeoId ? (
          <VimeoPlayer
            videoId={entry.vimeoId}
            title={entry.title}
            startTime={
              typeof entry.startTimeSeconds === "number"
                ? entry.startTimeSeconds
                : undefined
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Clip sin vista previa disponible
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-2xl font-semibold leading-snug">{entry.title}</h3>
          <p className="text-sm text-muted-foreground">{entry.reason}</p>
          {entry.supportingDetail ? (
            <p className="text-sm text-muted-foreground/80">
              {entry.supportingDetail}
            </p>
          ) : null}
        </div>

        {metadata.length > 0 ? (
          <dl className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
            {metadata.map((item) => (
              <div key={item.label}>
                <dt className="text-[0.6rem] uppercase tracking-wide">
                  {item.label}
                </dt>
                <dd className="text-sm text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {entry.tags && entry.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entry.tags.map((tag) => (
              <span
                className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                key={tag}
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* {entry.excerpt ? (
          <blockquote className="rounded-2xl bg-muted/40 p-3 text-sm text-muted-foreground">
            “{entry.excerpt}”
          </blockquote>
        ) : null} */}
        
      </div>
    </article>
  );
}

export const mafiPlaylistArtifact = new Artifact<"mafi-playlist">({
  kind: "mafi-playlist",
  description: "Curated selections from Archivo MAFI.",
  initialize: async () => undefined,
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-clear") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: "",
        status: "streaming",
        isVisible: false,
      }));
    }

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

    if (streamPart.type === "data-finish") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        status: "idle",
      }));
    }
  },
  content: ({ content, isLoading }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="mafi-playlist" />;
    }

    const parsed = safeParseMafiPlaylistDocument(content);

    if (!parsed) {
      return (
        <div className="flex w-full flex-col gap-4 px-4 py-8 text-sm text-muted-foreground">
          <p>No se pudo cargar la playlist del archivo MAFI.</p>
          <p>Intenta regenerar la respuesta o vuelve a abrir el documento.</p>
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col gap-8 px-4 py-8 md:px-12 md:py-12">
        <section className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Pregunta
          </div>
          <p className="text-lg font-medium leading-relaxed text-foreground">
            {parsed.question}
          </p>
          <div className="rounded-3xl border border-border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Comentario general
            </div>
            <p className="mt-1 text-base leading-relaxed text-foreground">
              {parsed.generalComment}
            </p>
          </div>
        </section>

        {parsed.playlist.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No se encontraron planos relevantes para esta consigna.
          </div>
        ) : (
          <ol className="space-y-8">
            {parsed.playlist.map((entry, index) => (
              <li key={`${entry.slug}-${index}`}>
                <PlaylistEntry entry={entry} index={index} />
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  },
  actions: [],
  toolbar: [],
});
