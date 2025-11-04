import { promises as fs } from "node:fs";
import path from "node:path";
import { Shot } from "./types";

type ShotIndex = {
  shots: Shot[];
  byId: Map<string, Shot>;
};

let cachedIndex: Promise<ShotIndex> | null = null;

const FRONTMATTER_PATTERN = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*([\s\S]*)$/;

const parseFrontmatterValue = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseFrontmatter = (raw: string) => {
  const data: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  let currentParent: string | null = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const isNested = /^\s{2,}/.test(line);
    const trimmed = line.trim();
    const separatorIndex = trimmed.indexOf("\":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(1, separatorIndex);
    const valuePortion = trimmed.slice(separatorIndex + 2);
    const parsedValue = parseFrontmatterValue(valuePortion);

    if (!isNested && parsedValue === "") {
      currentParent = key;
      if (typeof data[key] !== "object" || data[key] === null) {
        data[key] = {};
      }
      continue;
    }

    if (isNested && currentParent) {
      const parent = data[currentParent];
      if (typeof parent === "object" && parent !== null) {
        (parent as Record<string, unknown>)[key] = parsedValue;
      } else {
        data[currentParent] = { [key]: parsedValue };
      }
      continue;
    }

    data[key] = parsedValue;
    currentParent = null;
  }

  return data;
};

const parseShotFile = (filePath: string, contents: string): Shot | null => {
  const match = contents.match(FRONTMATTER_PATTERN);

  if (!match) {
    console.warn(`Skipping file without valid frontmatter: ${filePath}`);
    return null;
  }

  const [, frontmatterRaw, body] = match;
  const data = parseFrontmatter(frontmatterRaw);

  const id = String(data.genre ?? "").trim();
  const dir = String(data.name ?? "").trim();
  const shotTitle = String(data.stage_name ?? "").trim();
  const image = (data.image ?? {}) as Record<string, unknown>;
  const imageSrc = String(image.src ?? "").trim();
  const vimeoId = String(image.alt ?? "").trim();
  const description = body.trim();

  if (!id || !dir || !shotTitle || !vimeoId) {
    console.warn(`Skipping file with missing required metadata: ${filePath}`);
    return null;
  }

  return {
    id,
    dir,
    shotTitle,
    imageSrc,
    vimeoId,
    description,
  };
};

const buildShotIndex = async (): Promise<ShotIndex> => {
  const corpusDir = path.join(process.cwd(), "corpus");
  const entries = await fs.readdir(corpusDir, { withFileTypes: true });
  const shots: Shot[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const filePath = path.join(corpusDir, entry.name);
    const contents = await fs.readFile(filePath, "utf8");
    const shot = parseShotFile(filePath, contents);

    if (shot) {
      shots.push(shot);
    }
  }

  const byId = new Map<string, Shot>(shots.map((shot) => [shot.id, shot]));

  return {
    shots,
    byId,
  };
};

export const getShotIndex = async (): Promise<ShotIndex> => {
  if (!cachedIndex) {
    cachedIndex = buildShotIndex();
  }

  return cachedIndex;
};

export const getShotById = async (id: string) => {
  const { byId } = await getShotIndex();
  return byId.get(id);
};

export const resetShotIndexCache = () => {
  cachedIndex = null;
};
