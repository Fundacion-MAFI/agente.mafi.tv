import crypto from "node:crypto";

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function buildMarkdownFromShot(shot: {
  title: string;
  description?: string | null;
  historicContext?: string | null;
  aestheticCriticalCommentary?: string | null;
  productionCommentary?: string | null;
  vimeoUrl?: string | null;
  date?: string | null;
  place?: string | null;
  author?: string | null;
  geotag?: string | null;
  tags?: string[];
}): string {
  const tags = shot.tags ?? [];
  const frontmatter: Record<string, string | string[] | undefined> = {
    title: shot.title,
    vimeo_link: shot.vimeoUrl ?? undefined,
    date: shot.date ?? undefined,
    geotag: shot.geotag ?? undefined,
    place: shot.place ?? undefined,
    author: shot.author ?? undefined,
    description: shot.description ?? undefined,
    historic_context: shot.historicContext ?? undefined,
    aesthetic_critical_commentary:
      shot.aestheticCriticalCommentary ?? undefined,
    production_commentary: shot.productionCommentary ?? undefined,
    tags: tags.length > 0 ? tags : undefined,
  };

  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(
        `${key}: [${value.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(", ")}]`
      );
    } else {
      const escaped = String(value).replace(/"/g, '\\"');
      lines.push(`${key}: "${escaped}"`);
    }
  }
  lines.push("---");
  lines.push("");
  if (shot.description) {
    lines.push(shot.description);
    lines.push("");
  }
  return lines.join("\n");
}

/** Computes the checksum used for change detection during ingestion. */
export function computeShotChecksum(shot: {
  title: string;
  description?: string | null;
  historicContext?: string | null;
  aestheticCriticalCommentary?: string | null;
  productionCommentary?: string | null;
  vimeoUrl?: string | null;
  date?: string | null;
  place?: string | null;
  author?: string | null;
  geotag?: string | null;
  tags?: string[];
}): string {
  return sha256(buildMarkdownFromShot(shot));
}
