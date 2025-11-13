import { codeDocumentHandler } from "@/artifacts/code/server";
import { mafiPlaylistDocumentHandler } from "@/artifacts/mafi-playlist/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { ArtifactKind } from "@/components/artifact";
import type { DocumentHandler } from "./handlers";
export { createDocumentHandler } from "./handlers";
export type {
  CreateDocumentCallbackProps,
  UpdateDocumentCallbackProps,
} from "./handlers";

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
  mafiPlaylistDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet", "mafi-playlist"] as const;
