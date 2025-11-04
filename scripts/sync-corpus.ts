#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to sync the corpus");
  process.exit(1);
}

const API_BASE = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const VECTOR_STORE_NAME =
  process.env.MAFI_VECTOR_STORE_NAME ?? "mafi-vimeo-chatbot";
const existingVectorStoreId = process.env.MAFI_VECTOR_STORE_ID;

const baseHeaders = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
};

const createVectorStore = async () => {
  if (existingVectorStoreId) {
    return existingVectorStoreId;
  }

  const response = await fetch(`${API_BASE}/vector_stores`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: VECTOR_STORE_NAME }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create vector store: ${response.status} ${errorText}`
    );
  }

  const json = (await response.json()) as { id: string };
  return json.id;
};

const uploadFile = async (filePath: string) => {
  const fileName = path.basename(filePath);
  const fileContent = await readFile(filePath);
  const blob = new Blob([fileContent], { type: "text/markdown" });
  const formData = new FormData();

  formData.append("purpose", "assistants");
  formData.append("file", blob, fileName);

  const response = await fetch(`${API_BASE}/files`, {
    method: "POST",
    headers: baseHeaders,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload ${fileName}: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as { id: string };
  return json.id;
};

const addFileToVectorStore = async (
  vectorStoreId: string,
  fileId: string,
  fileName: string
) => {
  const response = await fetch(
    `${API_BASE}/vector_stores/${vectorStoreId}/files`,
    {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_id: fileId }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to add ${fileName} to vector store: ${response.status} ${errorText}`
    );
  }
};

const sync = async () => {
  const vectorStoreId = await createVectorStore();
  const corpusDir = path.join(process.cwd(), "corpus");
  const entries = await readdir(corpusDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(corpusDir, entry.name));

  console.log(`Syncing ${files.length} files to vector store ${vectorStoreId}`);

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    console.log(`Uploading ${fileName}...`);
    const fileId = await uploadFile(filePath);
    await addFileToVectorStore(vectorStoreId, fileId, fileName);
  }

  console.log("Sync complete");
};

sync().catch((error) => {
  console.error(error);
  process.exit(1);
});
