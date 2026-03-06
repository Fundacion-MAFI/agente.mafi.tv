import {
  createUIMessageStream,
  JsonToSseTransformStream,
  streamObject,
  type UIMessageStreamWriter,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth, type UserType } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { getEntitlementsForUserType } from "@/lib/ai/entitlements";
import { getAgenteFilmicoPrompt } from "@/lib/ai/get-prompts";
import {
  ArchivoTimeoutError,
  type RetrievedShot,
  retrieveRelevantShots,
} from "@/lib/ai/mafi-retrieval";
import { type MafiAnswer, mafiAnswerSchema } from "@/lib/ai/mafi-schema";
import type { ChatModel } from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import type { MafiPlaylistDocumentContent } from "@/lib/artifacts/mafi-playlist";
import {
  isProductionEnvironment,
  STREAM_TROUBLESHOOTING_MESSAGE,
} from "@/lib/constants";
import { getAdminSetting } from "@/lib/db/admin-settings";
import {
  createStreamId,
  deleteChatById,
  ensureUserExists,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveDocument,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { generateUUID, getTextFromMessage } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const runtime = "nodejs";
export const maxDuration = 60;
const ARCHIVO_OFFLINE_MESSAGE =
  "El modo Archivo está temporalmente fuera de línea. Verifica la configuración del AI Gateway y vuelve a intentarlo.";

const DIGITS_REGEX = /^\d+$/;
const SECONDS_REGEX = /^\d+s$/;
const HMS_REGEX = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
const HASH_REGEX = /^#/;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

type PlaylistDocumentReference = {
  id: string;
  title: string;
  kind: "mafi-playlist";
};

function serializeShotsForPrompt(
  question: string,
  shots: RetrievedShot[]
): string {
  const payload = {
    question,
    shots: shots.map((shot) => ({
      shotId: shot.id,
      slug: shot.slug,
      title: shot.title,
      author: shot.author,
      date: shot.date,
      place: shot.place,
      geotag: shot.geotag,
      tags: shot.tags,
      excerpt: shot.chunkContent,
      historicContext: shot.historicContext,
      aestheticCriticalCommentary: shot.aestheticCriticalCommentary,
      productionCommentary: shot.productionCommentary,
      similarity: shot.similarity,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

function buildPlaylistSummary(answer: MafiAnswer): string {
  const lines: string[] = [answer.generalComment.trim()];

  if (answer.playlist.length === 0) {
    lines.push(
      "",
      "No se encontraron planos del archivo que respondan directamente a esta búsqueda."
    );
    return lines.join("\n").trim();
  }

  // lines.push("", "Selección:");

  // for (const entry of answer.playlist) {
  //   const detail = entry.supportingDetail?.trim()
  //     ? ` — ${entry.supportingDetail.trim()}`
  //     : "";
  //   lines.push(`• ${entry.title}: ${entry.reason}${detail}`);
  // }

  return lines.join("\n").trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function buildPlaylistDocumentTitle(question: string): string {
  const sanitized = question.trim().replace(/\s+/g, " ");
  const base = sanitized ? `Agente Fílmico · ${sanitized}` : "Agente Fílmico";
  return truncate(base, 96);
}

function parseFlexibleTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (DIGITS_REGEX.test(normalized)) {
    return Number(normalized);
  }

  if (SECONDS_REGEX.test(normalized)) {
    return Number(normalized.slice(0, -1));
  }

  const hmsMatch = normalized.match(HMS_REGEX);

  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const hours = Number(hmsMatch[1] ?? 0);
    const minutes = Number(hmsMatch[2] ?? 0);
    const seconds = Number(hmsMatch[3] ?? 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (normalized.includes(":")) {
    const parts = normalized.split(":").map((part) => Number(part));

    if (parts.every((part) => Number.isFinite(part))) {
      return parts.reduce((total, part) => total * 60 + part);
    }
  }

  return null;
}

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [hrs, mins, secs]
    .filter((value, index) => value > 0 || index > 0)
    .map((value) => value.toString().padStart(2, "0"));

  if (parts.length === 0) {
    return "00:00";
  }

  return parts.join(":");
}

function extractVimeoMetadata(url: string | null | undefined): {
  videoId?: string;
  startTimeSeconds?: number;
  startTimeLabel?: string;
} {
  if (!url) {
    return {};
  }

  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const parsedUrl = new URL(normalizedUrl);
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const videoId = pathSegments.at(-1) ?? undefined;

    const searchStart =
      parsedUrl.searchParams.get("t") ?? parsedUrl.searchParams.get("start");

    let hashStart: string | null = null;

    if (parsedUrl.hash) {
      const hash = parsedUrl.hash.replace(HASH_REGEX, "");

      if (hash.includes("=")) {
        const params = new URLSearchParams(hash);
        hashStart = params.get("t") ?? params.get("start");
      } else if (hash.startsWith("t=")) {
        hashStart = hash.slice(2);
      } else if (hash.length > 0) {
        hashStart = hash;
      }
    }

    const startSeconds = parseFlexibleTime(searchStart ?? hashStart ?? null);

    if (typeof startSeconds === "number") {
      return {
        videoId,
        startTimeSeconds: startSeconds,
        startTimeLabel: formatSeconds(startSeconds),
      };
    }

    return { videoId };
  } catch (_error) {
    return {};
  }
}

function buildPlaylistDocumentContent({
  question,
  answer,
  shots,
}: {
  question: string;
  answer: MafiAnswer;
  shots: RetrievedShot[];
}): string {
  const normalizedQuestion = question.trim() || "Consulta sin descripción";
  const payload: MafiPlaylistDocumentContent = {
    question: normalizedQuestion,
    generalComment: answer.generalComment.trim(),
    playlist: [],
  };

  if (answer.playlist.length === 0) {
    return JSON.stringify(payload, null, 2);
  }

  const shotsById = new Map(shots.map((shot) => [shot.id, shot]));
  const shotsBySlug = new Map(shots.map((shot) => [shot.slug, shot]));

  payload.playlist = answer.playlist.map((entry, index) => {
    const shotMatch = entry.shotId
      ? shotsById.get(entry.shotId)
      : shotsBySlug.get(entry.slug);
    const vimeoMetadata = extractVimeoMetadata(shotMatch?.vimeoUrl ?? null);

    return {
      order: index + 1,
      title: entry.title,
      slug: entry.slug,
      reason: entry.reason,
      supportingDetail: entry.supportingDetail,
      shotId: entry.shotId,
      author: shotMatch?.author ?? null,
      date: shotMatch?.date ?? null,
      place: shotMatch?.place ?? null,
      tags: shotMatch?.tags ?? [],
      excerpt: shotMatch?.chunkContent ?? null,
      vimeoUrl: shotMatch?.vimeoUrl ?? null,
      vimeoId: vimeoMetadata.videoId ?? null,
      startTimeSeconds: vimeoMetadata.startTimeSeconds ?? null,
      startTimeLabel: vimeoMetadata.startTimeLabel ?? null,
    };
  });

  return JSON.stringify(payload, null, 2);
}

function createMafiPlaylistMessageStream({
  text,
  document,
}: {
  text: string;
  document?: PlaylistDocumentReference;
}) {
  const safeText = text.trim().length
    ? text.trim()
    : "No pude generar una lista en este momento.";
  const textId = generateUUID();
  const toolCallId = document ? generateUUID() : undefined;

  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "start" });
      controller.enqueue({ type: "start-step" });
      controller.enqueue({ type: "text-start", id: textId });
      controller.enqueue({ type: "text-delta", id: textId, delta: safeText });
      controller.enqueue({ type: "text-end", id: textId });

      if (document && toolCallId) {
        controller.enqueue({
          type: "tool-input-available",
          toolCallId,
          toolName: "createDocument",
          input: { title: document.title, kind: document.kind },
        });
        controller.enqueue({
          type: "tool-output-available",
          toolCallId,
          output: document,
        });
      }

      controller.enqueue({ type: "finish-step" });
      controller.enqueue({ type: "finish" });
      controller.close();
    },
  });
}

type ArchivoTimeoutPhase = "retrieval" | "playlist";

function logArchivoTimeoutEvent({
  chatId,
  streamId,
  phase,
  error,
}: {
  chatId: string;
  streamId: string;
  phase: ArchivoTimeoutPhase;
  error: unknown;
}) {
  const timeoutReason =
    error instanceof ArchivoTimeoutError
      ? error.reason
      : error instanceof Error && error.name === "AbortError"
        ? "abort_error"
        : "unknown";
  const timeoutContext =
    error instanceof ArchivoTimeoutError ? error.context : undefined;
  const timeoutMs =
    error instanceof ArchivoTimeoutError ? error.timeoutMs : undefined;

  console.error("Archivo mode timeout", {
    chatId,
    streamId,
    phase,
    timeoutReason,
    timeoutContext,
    timeoutMs,
    message: error instanceof Error ? error.message : String(error),
  });
}

function isAbortSignalError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function raceWithTimeout<T>({
  promise,
  timeoutMs,
  context,
  onTimeout,
}: {
  promise: Promise<T>;
  timeoutMs: number;
  context: string;
  onTimeout?: (error: ArchivoTimeoutError) => void;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const timeoutError = new ArchivoTimeoutError({
        context,
        timeoutMs,
        reason: "timeout",
      });

      onTimeout?.(timeoutError);
      reject(timeoutError);
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function sendArchivoOfflineResponse(
  dataStream: UIMessageStreamWriter<ChatMessage>
): void {
  dataStream.merge(
    createMafiPlaylistMessageStream({
      text: ARCHIVO_OFFLINE_MESSAGE,
    })
  );
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    const entitlements = await getEntitlementsForUserType(userType);
    if (messageCount > entitlements.maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      // Only fetch messages if chat already exists
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      await ensureUserExists(session.user.id);

      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
      // New chat - no need to fetch messages, it's empty
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const [archivoPrompt, retrievalLimit] = await Promise.all([
      getAgenteFilmicoPrompt(),
      getAdminSetting("retrieval.k"),
    ]);

    const archivoRetrievalTimeoutMs = 12_000;
    const archivoPlaylistTimeoutMs = 28_000;
    const archivoRetrievalLimit =
      typeof retrievalLimit === "number" && retrievalLimit >= 1
        ? retrievalLimit
        : 24;

    let finalMergedUsage: AppUsage | undefined;

    const DEFAULT_ARCHIVO_MODEL_ID: ChatModel["id"] = "film-agent";
    const allowedArchivoModels = new Set<ChatModel["id"]>([
      DEFAULT_ARCHIVO_MODEL_ID,
    ]);

    const handleArchivoRequest = async (
      dataStream: UIMessageStreamWriter<ChatMessage>
    ) => {
      const questionText = getTextFromMessage(message).trim();

      if (!questionText) {
        dataStream.merge(
          createMafiPlaylistMessageStream({
            text: "Necesito una pregunta o instrucción para buscar en el archivo MAFI. ¿Puedes intentarlo de nuevo?",
          })
        );
        return;
      }

      const retrievalAbortController = new AbortController();
      const retrievalAbortSignal = retrievalAbortController.signal;

      const handleArchivoOffline = (
        phase: ArchivoTimeoutPhase,
        error: unknown
      ) => {
        logArchivoTimeoutEvent({
          chatId: id,
          streamId,
          phase,
          error,
        });
        sendArchivoOfflineResponse(dataStream);
      };

      let retrievedShots: RetrievedShot[] = [];

      try {
        retrievedShots = await retrieveRelevantShots(questionText, {
          limit: archivoRetrievalLimit,
          signal: retrievalAbortSignal,
          timeoutMs: archivoRetrievalTimeoutMs,
        });
      } catch (error) {
        if (error instanceof ArchivoTimeoutError || isAbortSignalError(error)) {
          handleArchivoOffline("retrieval", error);
          return;
        }
        console.error("Error retrieving MAFI shots", error);
      } finally {
        retrievalAbortController.abort();
      }

      try {
        const playlistAbortController = new AbortController();
        const playlistAbortSignal = playlistAbortController.signal;
        const retrievalContext = serializeShotsForPrompt(
          questionText,
          retrievedShots
        );

        const archivoModelId = allowedArchivoModels.has(selectedChatModel)
          ? selectedChatModel
          : DEFAULT_ARCHIVO_MODEL_ID;
        const archiveModel = myProvider.languageModel(archivoModelId);
        const objectResult = streamObject({
          model: archiveModel,
          system: archivoPrompt,
          prompt: retrievalContext,
          schema: mafiAnswerSchema,
          abortSignal: playlistAbortSignal,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-object-mafi-playlist",
          },
        });
        const playlistStreamPromise = (async () => {
          for await (const part of objectResult.fullStream) {
            if (part.type === "error") {
              throw part.error;
            }
          }
        })();

        const answer = await raceWithTimeout({
          promise: objectResult.object,
          timeoutMs: archivoPlaylistTimeoutMs,
          context: "generating Archivo playlist",
          onTimeout: (timeoutError) =>
            playlistAbortController.abort(timeoutError),
        });
        const usage = await raceWithTimeout({
          promise: objectResult.usage.catch(() => {
            // ignore
          }),
          timeoutMs: archivoPlaylistTimeoutMs,
          context: "collecting Archivo usage metrics",
          onTimeout: (timeoutError) =>
            playlistAbortController.abort(timeoutError),
        }).catch(() => {
          // ignore
        });

        await playlistStreamPromise;

        if (usage) {
          try {
            const providers = await getTokenlensCatalog();
            const modelId = archiveModel.modelId;

            if (modelId && providers) {
              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = {
                ...usage,
                ...summary,
                modelId,
              } as AppUsage;
            } else {
              finalMergedUsage = usage as AppUsage;
            }
          } catch (error) {
            console.warn("TokenLens enrichment failed", error);
            finalMergedUsage = usage as AppUsage;
          }

          if (finalMergedUsage) {
            dataStream.write({
              type: "data-usage",
              data: finalMergedUsage,
            });
          }
        }

        const documentId = generateUUID();
        const documentTitle = buildPlaylistDocumentTitle(questionText);
        const documentContent = buildPlaylistDocumentContent({
          question: questionText,
          answer,
          shots: retrievedShots,
        });

        await saveDocument({
          id: documentId,
          title: documentTitle,
          kind: "mafi-playlist",
          content: documentContent,
          userId: session.user.id,
        });

        const playlistText = buildPlaylistSummary(answer);
        const documentReference: PlaylistDocumentReference = {
          id: documentId,
          title: documentTitle,
          kind: "mafi-playlist",
        };

        dataStream.write({
          type: "data-kind",
          data: "mafi-playlist",
          transient: true,
        });
        dataStream.write({
          type: "data-id",
          data: documentId,
          transient: true,
        });
        dataStream.write({
          type: "data-title",
          data: documentTitle,
          transient: true,
        });
        dataStream.write({ type: "data-clear", data: null, transient: true });
        dataStream.write({
          type: "data-textDelta",
          data: `${documentContent}\n`,
          transient: true,
        });
        dataStream.write({ type: "data-finish", data: null, transient: true });

        dataStream.merge(
          createMafiPlaylistMessageStream({
            text: playlistText,
            document: documentReference,
          })
        );
      } catch (error) {
        if (error instanceof ArchivoTimeoutError || isAbortSignalError(error)) {
          handleArchivoOffline("playlist", error);
          return;
        }
        console.error("Agente Fílmico flow failed", error);
        dataStream.merge(
          createMafiPlaylistMessageStream({
            text: "No pude crear una lista del archivo en este momento. Intenta nuevamente más tarde.",
          })
        );
      }
    };

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) =>
        handleArchivoRequest(dataStream),
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return STREAM_TROUBLESHOOTING_MESSAGE;
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
