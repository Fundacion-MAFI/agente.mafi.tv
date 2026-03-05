import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import matter from "gray-matter";
import postgres from "postgres";

import { generateShotEmbeddings } from "../lib/ai/mafi-embeddings";
import { shotEmbeddings, shots } from "../lib/db/schema/shots";

// Load env: prefer .env.local for local overrides, fall back to .env
config({ path: ".env.local" });
config();

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "POSTGRES_URL or POSTGRES_URL_NON_POOLING must be defined to ingest the archive"
  );
}

const dataDirectory = path.join(process.cwd(), "data", "mafi-shots");
const shouldPrune = process.argv.includes("--prune");

const INGEST_DEFAULTS = {
  throttleEnabled: false,
  throttleDelayMs: 2000,
  chunkSize: 800,
  chunkOverlap: 200,
};

async function getIngestConfig(
  sql: ReturnType<typeof postgres>
): Promise<typeof INGEST_DEFAULTS> {
  try {
    const rows = await sql`
      SELECT key, value FROM admin_settings
      WHERE key IN (
        'ingest.throttle_enabled',
        'ingest.throttle_delay_ms',
        'embedding.chunk_size',
        'embedding.chunk_overlap'
      )
    `;

    const map = Object.fromEntries(
      rows.map((r: { key: string; value: unknown }) => [r.key, r.value])
    );

    const throttle =
      map["ingest.throttle_enabled"] === true ||
      process.env.INGEST_THROTTLE_EMBEDDINGS === "1" ||
      process.env.INGEST_THROTTLE_EMBEDDINGS === "true" ||
      process.env.INGEST_THROTTLE_EMBEDDINGS === "yes";
    const delay =
      typeof map["ingest.throttle_delay_ms"] === "number" &&
      map["ingest.throttle_delay_ms"] >= 0
        ? (map["ingest.throttle_delay_ms"] as number)
        : Number.parseInt(
            process.env.INGEST_THROTTLE_DELAY_MS ?? "2000",
            10
          );
    const chunk =
      typeof map["embedding.chunk_size"] === "number" &&
      map["embedding.chunk_size"] > 0
        ? (map["embedding.chunk_size"] as number)
        : 800;
    const overlap =
      typeof map["embedding.chunk_overlap"] === "number" &&
      map["embedding.chunk_overlap"] >= 0
        ? (map["embedding.chunk_overlap"] as number)
        : 200;

    return {
      throttleEnabled: throttle,
      throttleDelayMs: delay,
      chunkSize: chunk,
      chunkOverlap: overlap,
    };
  } catch {
    return {
      ...INGEST_DEFAULTS,
      throttleEnabled:
        process.env.INGEST_THROTTLE_EMBEDDINGS === "1" ||
        process.env.INGEST_THROTTLE_EMBEDDINGS === "true" ||
        process.env.INGEST_THROTTLE_EMBEDDINGS === "yes",
      throttleDelayMs: Number.parseInt(
        process.env.INGEST_THROTTLE_DELAY_MS ?? "2000",
        10
      ),
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sqlClient = postgres(connectionString, { max: 1 });
const db = drizzle(sqlClient);

type ShotFrontMatter = {
  title?: string;
  description?: string;
  historic_context?: string;
  vimeo_link?: string;
  date?: string;
  place?: string;
  author?: string;
  geotag?: string;
  tags?: string[] | string;
};

async function getMarkdownFiles() {
  const files = await fs.readdir(dataDirectory);
  return files.filter((file) => file.endsWith(".md")).sort();
}

async function ensureShotsSchema() {
  const [result] = (await sqlClient`
    SELECT
      to_regclass('public.shots') AS shots,
      to_regclass('public.shot_embeddings') AS "shotEmbeddings"
  `) as {
    shots: string | null;
    shotEmbeddings: string | null;
  }[];

  const missingTables: string[] = [];
  if (!result?.shots) {
    missingTables.push("shots");
  }
  if (!result?.shotEmbeddings) {
    missingTables.push("shot_embeddings");
  }

  if (missingTables.length > 0) {
    console.warn(
      `⚠️ Missing tables (${missingTables.join(", ")}). Run \`pnpm db:migrate\` first to provision the schema.`
    );
    await sqlClient.end();
    process.exit(0);
  }
}

function sha256(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function normalizeTags(raw: ShotFrontMatter["tags"]): string[] {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((tag) => tag.trim()).filter(Boolean);
  }

  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function upsertShotFromFile(
  relativePath: string,
  embeddingOptions: { chunkSize: number; chunkOverlap: number }
) {
  const fullPath = path.join(dataDirectory, relativePath);
  const fileContent = await fs.readFile(fullPath, "utf8");
  const checksum = sha256(fileContent);
  const { data, content } = matter(fileContent);
  const metadata = data as ShotFrontMatter;
  const slug = path.basename(relativePath, path.extname(relativePath));
  const existing = await db
    .select({ id: shots.id, checksum: shots.checksum })
    .from(shots)
    .where(eq(shots.slug, slug))
    .limit(1);

  const now = new Date();
  const tags = normalizeTags(metadata.tags);
  const contentBody = content.trim();
  const description = metadata.description ?? (contentBody || null);
  const fields = {
    slug,
    title: metadata.title ?? slug,
    description,
    historicContext: metadata.historic_context ?? null,
    vimeoUrl: metadata.vimeo_link ?? null,
    date: metadata.date ?? null,
    place: metadata.place ?? null,
    author: metadata.author ?? null,
    geotag: metadata.geotag ?? null,
    tags,
    checksum,
    updatedAt: now,
  } satisfies typeof shots.$inferInsert;

  const [upserted] = await db
    .insert(shots)
    .values({ ...fields })
    .onConflictDoUpdate({ target: shots.slug, set: fields })
    .returning({ id: shots.id });

  const shouldUpdateEmbeddings =
    existing.length === 0 || existing[0].checksum !== checksum;

  if (!shouldUpdateEmbeddings) {
    return { updatedEmbeddings: false };
  }

  const textToEmbed = [
    metadata.title,
    metadata.description,
    metadata.historic_context,
    metadata.place,
    metadata.author,
    metadata.date,
    metadata.geotag,
    tags.join(", "),
    contentBody,
  ]
    .map((section) => section?.trim())
    .filter(Boolean)
    .join("\n\n");

  const embeddingChunks = await generateShotEmbeddings(textToEmbed, {
    chunkSize: embeddingOptions.chunkSize,
    chunkOverlap: embeddingOptions.chunkOverlap,
  });

  await db.transaction(async (tx) => {
    await tx
      .delete(shotEmbeddings)
      .where(eq(shotEmbeddings.shotId, upserted.id));

    if (embeddingChunks.length > 0) {
      await tx.insert(shotEmbeddings).values(
        embeddingChunks.map((chunk) => ({
          shotId: upserted.id,
          content: chunk.content,
          embedding: chunk.embedding,
        }))
      );
    }
  });

  return { updatedEmbeddings: true };
}

async function pruneRemovedShots(processedSlugs: Set<string>) {
  if (!shouldPrune) {
    return 0;
  }

  const existing = await db.select({ slug: shots.slug }).from(shots);
  const toDelete = existing
    .map((record) => record.slug)
    .filter((slug) => !processedSlugs.has(slug));

  if (toDelete.length === 0) {
    return 0;
  }

  await db.delete(shots).where(inArray(shots.slug, toDelete));
  return toDelete.length;
}

async function main() {
  await ensureShotsSchema();

  const ingestConfig = await getIngestConfig(sqlClient);

  console.log("📼 Ingesting MAFI shots from", dataDirectory);
  const files = await getMarkdownFiles();
  const processedSlugs = new Set<string>();
  let embeddingsUpdated = 0;

  if (ingestConfig.throttleEnabled) {
    console.log(
      `⏱️  Throttling enabled: ${ingestConfig.throttleDelayMs}ms delay between embedding calls`
    );
  }

  for (const file of files) {
    const slug = path.basename(file, path.extname(file));
    processedSlugs.add(slug);
    const result = await upsertShotFromFile(file, {
      chunkSize: ingestConfig.chunkSize,
      chunkOverlap: ingestConfig.chunkOverlap,
    });
    if (result.updatedEmbeddings) {
      embeddingsUpdated += 1;
      console.log(`✅ Updated embeddings for shot ${slug}`);
      if (ingestConfig.throttleEnabled && ingestConfig.throttleDelayMs > 0) {
        await sleep(ingestConfig.throttleDelayMs);
      }
    } else {
      console.log(`⚪️ Shot ${slug} is up to date`);
    }
  }

  const pruned = await pruneRemovedShots(processedSlugs);

  console.log(
    `🏁 Processed ${files.length} shots, refreshed embeddings for ${embeddingsUpdated}, pruned ${pruned}`
  );

  await sqlClient.end();
}

main().catch(async (error) => {
  console.error("❌ Failed to ingest MAFI shots");
  console.error(error);
  await sqlClient.end();
  process.exit(1);
});
