import "server-only";

import type { Geo } from "@vercel/functions";
import type { ArtifactKind } from "@/components/artifact";
import {
  AGENTE_FILMICO_SYSTEM_PROMPT,
  artifactsPrompt,
  codePrompt,
  getRequestPromptFromHints,
  regularPrompt,
  sheetPrompt,
  titlePrompt,
} from "@/lib/ai/prompts";
import { getAdminSetting } from "@/lib/db/admin-settings";

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

const UPDATE_DOCUMENT_DEFAULT =
  "Improve the following contents of the {mediaType} based on the given prompt.\n\n{currentContent}";

export async function getAgenteFilmicoPrompt(): Promise<string> {
  const stored = await getAdminSetting("prompts.agente_filmico");
  return typeof stored === "string" && stored.trim().length > 0
    ? stored
    : AGENTE_FILMICO_SYSTEM_PROMPT;
}

export async function getRegularPrompt(): Promise<string> {
  const stored = await getAdminSetting("prompts.regular");
  return typeof stored === "string" && stored.trim().length > 0
    ? stored
    : regularPrompt;
}

export async function getArtifactsPrompt(): Promise<string> {
  const stored = await getAdminSetting("prompts.artifacts");
  return typeof stored === "string" && stored.trim().length > 0
    ? stored
    : artifactsPrompt;
}

export async function getCodePrompt(): Promise<string> {
  const stored = await getAdminSetting("prompts.code");
  return typeof stored === "string" && stored.trim().length > 0
    ? stored
    : codePrompt;
}

export async function getSheetPrompt(): Promise<string> {
  const stored = await getAdminSetting("prompts.sheet");
  return typeof stored === "string" && stored.trim().length > 0
    ? stored
    : sheetPrompt;
}

export async function getTitlePrompt(): Promise<string> {
  const stored = await getAdminSetting("prompts.title");
  return typeof stored === "string" && stored.trim().length > 0
    ? stored
    : titlePrompt;
}

export async function getSystemPrompt(
  requestHints: RequestHints
): Promise<string> {
  const [regular, artifacts] = await Promise.all([
    getRegularPrompt(),
    getArtifactsPrompt(),
  ]);
  const requestPrompt = getRequestPromptFromHints(requestHints);
  return `${regular}\n\n${requestPrompt}\n\n${artifacts}`;
}

export async function getUpdateDocumentPrompt(): Promise<
  (currentContent: string | null, type: ArtifactKind) => string
> {
  const stored = await getAdminSetting("prompts.update_document");
  const template =
    typeof stored === "string" && stored.trim().length > 0
      ? stored
      : UPDATE_DOCUMENT_DEFAULT;

  return (currentContent: string | null, type: ArtifactKind) => {
    let mediaType = "document";
    if (type === "code") {
      mediaType = "code snippet";
    } else if (type === "sheet") {
      mediaType = "spreadsheet";
    }
    return template
      .replace("{mediaType}", mediaType)
      .replace("{currentContent}", currentContent ?? "");
  };
}
