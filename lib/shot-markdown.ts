/**
 * Serialize and parse shot data as Markdown with YAML frontmatter.
 * Used for single-shot export/update in the shot editor.
 */

export type ShotMarkdownData = {
  slug?: string;
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
};

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,|]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/** All frontmatter keys in export order. Empty fields are included so the format is self-documenting. */
const FRONTMATTER_KEYS = [
  "slug",
  "title",
  "vimeo_link",
  "description",
  "historic_context",
  "aesthetic_critical_commentary",
  "production_commentary",
  "date",
  "place",
  "author",
  "geotag",
  "tags",
] as const;

/** Convert shot data to Markdown with frontmatter. All fields are always included (empty string when blank). */
export function shotToMarkdown(shot: ShotMarkdownData): string {
  const tags = shot.tags ?? [];
  const values: Record<string, string | string[]> = {
    slug: shot.slug ?? "",
    title: shot.title ?? "",
    vimeo_link: shot.vimeoUrl ?? "",
    description: shot.description ?? "",
    historic_context: shot.historicContext ?? "",
    aesthetic_critical_commentary: shot.aestheticCriticalCommentary ?? "",
    production_commentary: shot.productionCommentary ?? "",
    date: shot.date ?? "",
    place: shot.place ?? "",
    author: shot.author ?? "",
    geotag: shot.geotag ?? "",
    tags,
  };

  const lines: string[] = ["---"];
  for (const key of FRONTMATTER_KEYS) {
    const value = values[key];
    if (Array.isArray(value)) {
      lines.push(
        `${key}: [${value.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(", ")}]`
      );
    } else {
      const escaped = String(value ?? "").replace(/"/g, '\\"');
      lines.push(`${key}: "${escaped}"`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

/** Parse Markdown with frontmatter into shot data. Only frontmatter is used; body is ignored. */
export function parseMarkdownToShot(
  markdown: string
): Partial<ShotMarkdownData> {
  const result: Partial<ShotMarkdownData> = {};
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    const lines = fm.split(/\r?\n/);
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const key = line.slice(0, colonIdx).trim();
      let raw = line.slice(colonIdx + 1).trim();
      let value: string | string[];
      if (raw.startsWith('"') && raw.endsWith('"')) {
        value = raw.slice(1, -1).replace(/\\"/g, '"');
      } else if (raw.startsWith("[") && raw.endsWith("]")) {
        const inner = raw.slice(1, -1);
        const items = inner.match(/"([^"]*(?:\\"[^"]*)*)"/g);
        value = items
          ? items.map((s) => s.slice(1, -1).replace(/\\"/g, '"'))
          : [];
      } else {
        value = raw;
      }
      switch (key) {
        case "slug":
          result.slug = typeof value === "string" ? value : undefined;
          break;
        case "title":
          result.title = typeof value === "string" ? value : "";
          break;
        case "vimeo_link":
          result.vimeoUrl = typeof value === "string" && value ? value : null;
          break;
        case "date":
          result.date = typeof value === "string" && value ? value : null;
          break;
        case "geotag":
          result.geotag = typeof value === "string" && value ? value : null;
          break;
        case "place":
          result.place = typeof value === "string" && value ? value : null;
          break;
        case "author":
          result.author = typeof value === "string" && value ? value : null;
          break;
        case "description":
          result.description =
            typeof value === "string" && value ? value : null;
          break;
        case "historic_context":
          result.historicContext =
            typeof value === "string" && value ? value : null;
          break;
        case "aesthetic_critical_commentary":
          result.aestheticCriticalCommentary =
            typeof value === "string" && value ? value : null;
          break;
        case "production_commentary":
          result.productionCommentary =
            typeof value === "string" && value ? value : null;
          break;
        case "tags":
          result.tags = parseTags(value);
          break;
        default:
          break;
      }
    }
  }

  return result;
}
