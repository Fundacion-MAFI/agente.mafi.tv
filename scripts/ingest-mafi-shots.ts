import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { eq, inArray } from "drizzle-orm";

import { generateShotEmbeddings } from "@/lib/ai/mafi-embeddings";
import { db } from "@/lib/db/client";
import { shotEmbeddings, shots, type Shot } from "@/lib/db/schema";

const DATA_DIRECTORY = path.resolve(process.cwd(), "data/mafi-shots");

type FrontMatterValue = string | string[] | undefined;

type FrontMatterResult = {
  data: Record<string, FrontMatterValue>;
  body: string;
};

function parseFrontMatter(source: string): FrontMatterResult {
  const delimiter = /^---\s*$/m;
  const lines = source.split(/\r?\n/);

  if (lines.length === 0 || !delimiter.test(lines[0])) {
    return { data: {}, body: source };
  }

  const data: Record<string, FrontMatterValue> = {};
  let index = 1;
  let currentKey: string | null = null;

  while (index < lines.length) {
    const line = lines[index];

    if (delimiter.test(line)) {
      index += 1;
      break;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("- ") && currentKey) {
      const value = line.trim().slice(2).trim();
      const normalized = stripQuotes(value);
      const list = Array.isArray(data[currentKey])
        ? (data[currentKey] as string[])
        : [];
      list.push(normalized);
      data[currentKey] = list;
      index += 1;
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      index += 1;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    currentKey = key;

    if (!rawValue) {
      data[key] = [];
      index += 1;
      continue;
    }

    data[key] = parseValue(rawValue);
    index += 1;
  }

  const body = lines.slice(index).join("\n");

  return { data, body };
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseValue(value: string): FrontMatterValue {
  const normalized = stripQuotes(value);

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const inner = normalized.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner.split(",").map((entry) => stripQuotes(entry));
  }

  return normalized;
}

async function main() {
  const files = await fs.readdir(DATA_DIRECTORY);
  const markdownFiles = files.filter((file) => file.endsWith(".md")).sort();

  const existingShots = await db.select().from(shots);
  const shotsBySlug = new Map(existingShots.map((shot) => [shot.slug, shot]));
  const seenSlugs = new Set<string>();

  let upserted = 0;
  let skipped = 0;

  for (const fileName of markdownFiles) {
    const filePath = path.join(DATA_DIRECTORY, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const { data, body } = parseFrontMatter(raw);

    const slug = path.basename(fileName, path.extname(fileName));
    seenSlugs.add(slug);

    const title = ensureString(data.title, "title");
    const description = ensureString(data.description, "description");
    const vimeoUrl = ensureString(
      data.vimeo_link ?? data.vimeoUrl ?? data.vimeo,
      "vimeo_link"
    );

    const metadata = {
      title,
      description,
      vimeoUrl,
      date: optionalString(data.date),
      place: optionalString(data.place),
      author: optionalString(data.author),
      geotag: optionalString(data.geotag),
      tags: Array.isArray(data.tags)
        ? (data.tags as string[])
        : optionalString(data.tags)
          ?.split(",")
          .map((tag) => tag.trim()) ?? null,
    } satisfies Partial<Shot>;

    const checksum = crypto.createHash("sha256").update(raw).digest("hex");
    const existing = shotsBySlug.get(slug);

    if (existing && existing.checksum === checksum) {
      skipped += 1;
      continue;
    }

    const now = new Date();
    let shotId: string;

    if (existing) {
      await db
        .update(shots)
        .set({
          ...metadata,
          slug,
          checksum,
          updatedAt: now,
        })
        .where(eq(shots.id, existing.id));
      shotId = existing.id;
    } else {
      const [inserted] = await db
        .insert(shots)
        .values({
          ...metadata,
          slug,
          checksum,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: shots.id });

      shotId = inserted.id;
    }

    await db.delete(shotEmbeddings).where(eq(shotEmbeddings.shotId, shotId));

    const textForEmbedding = [
      title,
      description,
      metadata.place,
      metadata.author,
      metadata.date,
      metadata.tags?.join(", "),
      body.trim(),
    ]
      .flatMap((value) => (value ? [value] : []))
      .join("\n\n");

    const embeddings = await generateShotEmbeddings(textForEmbedding);

    if (embeddings.length > 0) {
      await db.insert(shotEmbeddings).values(
        embeddings.map((embedding) => ({
          shotId,
          content: embedding.content,
          embedding: embedding.embedding,
        }))
      );
    }

    upserted += 1;
  }

  const slugsToDelete = existingShots
    .filter((shot) => !seenSlugs.has(shot.slug))
    .map((shot) => shot.id);

  if (slugsToDelete.length > 0) {
    await db.delete(shots).where(inArray(shots.id, slugsToDelete));
  }

  const deleted = slugsToDelete.length;

  // eslint-disable-next-line no-console
  console.log(
    `MAFI ingestion complete. Upserted: ${upserted}, skipped: ${skipped}, deleted: ${deleted}`
  );
}

function ensureString(value: FrontMatterValue, field: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`Missing required field "${field}" in front matter.`);
}

function optionalString(value: FrontMatterValue): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

main().catch((error) => {
  console.error("Failed to ingest MAFI shots", error);
  process.exit(1);
});
