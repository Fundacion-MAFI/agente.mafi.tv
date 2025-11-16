import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamObject,
  streamText,
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
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { mafiAnswerSchema, type MafiAnswer } from "@/lib/ai/mafi-schema";
import { retrieveRelevantShots, type RetrievedShot } from "@/lib/ai/mafi-retrieval";
import type { MafiPlaylistDocumentContent } from "@/lib/artifacts/mafi-playlist";
import {
  AGENTE_FILMICO_SYSTEM_PROMPT,
  type RequestHints,
  systemPrompt,
} from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
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
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

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

  lines.push("", "Selección:");

  for (const entry of answer.playlist) {
    const detail = entry.supportingDetail?.trim()
      ? ` — ${entry.supportingDetail.trim()}`
      : "";
    lines.push(`• ${entry.title}: ${entry.reason}${detail}`);
  }

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

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (/^\d+s$/.test(normalized)) {
    return Number(normalized.slice(0, -1));
  }

  const hmsMatch = normalized.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);

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
      const hash = parsedUrl.hash.replace(/^#/, "");

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

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
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

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

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

    let finalMergedUsage: AppUsage | undefined;

    const isArchivoMode = message.mode === "archivo";
    const allowedArchivoModels = new Set<ChatModel["id"]>(["film-agent"]);

    const handleArchivoRequest = async (
      dataStream: UIMessageStreamWriter<ChatMessage>
    ) => {
      const questionText = getTextFromMessage(message).trim();

      if (!questionText) {
        dataStream.merge(
          createMafiPlaylistMessageStream({
            text:
              "Necesito una pregunta o instrucción para buscar en el archivo MAFI. ¿Puedes intentarlo de nuevo?",
          })
        );
        return;
      }

      let retrievedShots: RetrievedShot[] = [];

      try {
        retrievedShots = await retrieveRelevantShots(questionText);
      } catch (error) {
        console.error("Error retrieving MAFI shots", error);
      }

      try {
        const retrievalContext = serializeShotsForPrompt(
          questionText,
          retrievedShots
        );

        const archivoModelId = allowedArchivoModels.has(selectedChatModel)
          ? selectedChatModel
          : "film-agent";
        const archiveModel = myProvider.languageModel(archivoModelId);
        const objectResult = streamObject({
          model: archiveModel,
          system: AGENTE_FILMICO_SYSTEM_PROMPT,
          prompt: retrievalContext,
          schema: mafiAnswerSchema,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-object-mafi-playlist",
          },
        });

        const [answer, usage] = await Promise.all([
          objectResult.object,
          objectResult.usage.catch(() => undefined),
        ]);

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
        console.error("Agente Fílmico flow failed", error);
        dataStream.merge(
          createMafiPlaylistMessageStream({
            text:
              "No pude crear una lista del archivo en este momento. Intenta nuevamente más tarde.",
          })
        );
      }
    };

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        if (isArchivoMode) {
          return handleArchivoRequest(dataStream);
        }

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === "chat-model-reasoning"
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
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
        return "Oops, an error occurred!";
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
