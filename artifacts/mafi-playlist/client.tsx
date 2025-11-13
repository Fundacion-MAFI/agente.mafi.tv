import { Artifact } from "@/components/create-artifact";

export type MafiPlaylistContent = {
  generalComment: string;
  question?: string;
  shots: {
    id: string;
    slug: string;
    title: string;
    vimeoUrl: string;
    recommendedStartSeconds?: number;
    recommendedEndSeconds?: number;
    reason: string;
    tags?: string[];
    author?: string | null;
    place?: string | null;
    date?: string | null;
  }[];
  followUpSuggestions?: string[];
};

function safeParseContent(content: string | null | undefined): MafiPlaylistContent | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as MafiPlaylistContent;
    if (Array.isArray(parsed?.shots)) {
      return parsed;
    }
  } catch (error) {
    console.error("Failed to parse mafi-playlist content", error);
  }

  return null;
}

function buildVimeoEmbedUrl(url: string, start?: number): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const videoId = segments.at(-1);

    if (!videoId) {
      return url;
    }

    const base = `https://player.vimeo.com/video/${videoId}`;

    if (typeof start === "number" && Number.isFinite(start) && start >= 0) {
      return `${base}#t=${Math.floor(start)}s`;
    }

    return base;
  } catch (_error) {
    return url;
  }
}

function formatTimeRange(
  start?: number,
  end?: number
): string | null {
  if (typeof start !== "number" && typeof end !== "number") {
    return null;
  }

  const segments: string[] = [];

  if (typeof start === "number" && start >= 0) {
    segments.push(`desde ${Math.floor(start)}s`);
  }

  if (typeof end === "number" && end >= 0) {
    segments.push(`hasta ${Math.floor(end)}s`);
  }

  if (segments.length === 0) {
    return null;
  }

  return segments.join(" ");
}

export const mafiPlaylistArtifact = new Artifact<"mafi-playlist", void>({
  kind: "mafi-playlist",
  description: "Playlist de planos recomendados del archivo MAFI.",
  content: ({ content, isLoading }) => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Cargando playlist…
        </div>
      );
    }

    const parsed = safeParseContent(content);

    if (!parsed) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No hay contenido disponible para esta playlist.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 px-4 py-6">
        {parsed.generalComment ? (
          <p className="text-base leading-relaxed text-foreground/90">
            {parsed.generalComment}
          </p>
        ) : null}

        <div className="flex flex-col gap-6">
          {parsed.shots.map((shot, index) => {
            const embedUrl = buildVimeoEmbedUrl(
              shot.vimeoUrl,
              shot.recommendedStartSeconds
            );
            const timeRange = formatTimeRange(
              shot.recommendedStartSeconds,
              shot.recommendedEndSeconds
            );

            return (
              <div
                key={shot.id ?? `${shot.slug}-${index}`}
                className="rounded-xl border border-white/10 bg-black/30 p-4 shadow-lg"
              >
                <div className="mb-3 flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-white">
                    {shot.title}
                  </h3>
                  <div className="text-xs uppercase tracking-wide text-white/70">
                    {[shot.author, shot.place, shot.date]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {timeRange ? (
                    <span className="text-xs font-medium text-emerald-300/80">
                      {timeRange}
                    </span>
                  ) : null}
                  {shot.tags && shot.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {shot.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/80"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <iframe
                    src={embedUrl}
                    className="h-full w-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={shot.title}
                  />
                </div>

                {shot.reason ? (
                  <p className="mt-3 text-sm leading-relaxed text-white/80">
                    {shot.reason}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {parsed.followUpSuggestions &&
        parsed.followUpSuggestions.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/80">
              Para seguir investigando
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-white/80">
              {parsed.followUpSuggestions.map((suggestion, index) => (
                <li key={`${suggestion}-${index}`}>{suggestion}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  },
});
