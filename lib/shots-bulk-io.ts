/**
 * Bulk import/export of shots as CSV or XLSX.
 * Column names match the API (snake_case for consistency with markdown).
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

export const BULK_COLUMNS = [
  "slug",
  "title",
  "description",
  "historic_context",
  "aesthetic_critical_commentary",
  "production_commentary",
  "vimeo_url",
  "date",
  "place",
  "author",
  "geotag",
  "tags",
] as const;

export type BulkShotRow = {
  slug: string;
  title: string;
  description: string | null;
  historic_context: string | null;
  aesthetic_critical_commentary: string | null;
  production_commentary: string | null;
  vimeo_url: string | null;
  date: string | null;
  place: string | null;
  author: string | null;
  geotag: string | null;
  tags: string; // comma or pipe separated
};

function parseTags(tags: string | null | undefined): string[] {
  if (!tags?.trim()) return [];
  return tags
    .split(/[,|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toApiRow(row: Record<string, unknown>): BulkShotRow {
  const get = (k: string) => {
    const v = row[k] ?? row[k.replace(/_/g, " ")] ?? null;
    return v != null && v !== "" ? String(v).trim() : null;
  };
  return {
    slug: get("slug") ?? "",
    title: get("title") ?? "",
    description: get("description"),
    historic_context: get("historic_context"),
    aesthetic_critical_commentary: get("aesthetic_critical_commentary"),
    production_commentary: get("production_commentary"),
    vimeo_url: get("vimeo_url"),
    date: get("date"),
    place: get("place"),
    author: get("author"),
    geotag: get("geotag"),
    tags: get("tags") ?? "",
  };
}

/** Parse CSV buffer into shot rows. */
export function parseCsvToShots(buffer: Buffer): BulkShotRow[] {
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data
    .map(toApiRow)
    .filter((r) => r.slug?.trim() && r.title?.trim());
}

/** Parse XLSX buffer into shot rows. */
export function parseXlsxToShots(buffer: Buffer): BulkShotRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map(toApiRow).filter((r) => r.slug?.trim() && r.title?.trim());
}

/** Convert shot rows to CSV string. */
export function shotsToCsv(rows: BulkShotRow[]): string {
  return Papa.unparse(
    rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      description: r.description ?? "",
      historic_context: r.historic_context ?? "",
      aesthetic_critical_commentary: r.aesthetic_critical_commentary ?? "",
      production_commentary: r.production_commentary ?? "",
      vimeo_url: r.vimeo_url ?? "",
      date: r.date ?? "",
      place: r.place ?? "",
      author: r.author ?? "",
      geotag: r.geotag ?? "",
      tags: Array.isArray(r.tags)
        ? (r.tags as string[]).join(", ")
        : (r.tags ?? ""),
    }))
  );
}

/** Convert shot rows to XLSX buffer. */
export function shotsToXlsx(rows: BulkShotRow[]): Buffer {
  const data = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description ?? "",
    historic_context: r.historic_context ?? "",
    aesthetic_critical_commentary: r.aesthetic_critical_commentary ?? "",
    production_commentary: r.production_commentary ?? "",
    vimeo_url: r.vimeo_url ?? "",
    date: r.date ?? "",
    place: r.place ?? "",
    author: r.author ?? "",
    geotag: r.geotag ?? "",
    tags: Array.isArray(r.tags)
      ? (r.tags as string[]).join(", ")
      : (r.tags ?? ""),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Shots");
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  );
}

/** Convert BulkShotRow to API payload. */
export function bulkRowToApiPayload(row: BulkShotRow) {
  return {
    slug: row.slug.trim().replace(/[^a-zA-Z0-9-_]/g, "-"),
    title: row.title.trim(),
    description: row.description ?? null,
    historicContext: row.historic_context ?? null,
    aestheticCriticalCommentary: row.aesthetic_critical_commentary ?? null,
    productionCommentary: row.production_commentary ?? null,
    vimeoUrl: row.vimeo_url ?? null,
    date: row.date ?? null,
    place: row.place ?? null,
    author: row.author ?? null,
    geotag: row.geotag ?? null,
    tags: parseTags(row.tags),
  };
}
