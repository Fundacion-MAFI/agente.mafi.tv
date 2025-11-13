import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  type UIMessageStreamWriter,
  smoothStream,
  stepCountIs,
  streamObject,
  streamText,
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
import {
  AGENTE_FILMICO_MODE_APPENDIX,
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
import { mafiAnswerSchema } from "@/lib/ai/mafi-schema";
import { retrieveRelevantShots } from "@/lib/ai/mafi-retrieval";
import type { MafiShotContext } from "@/lib/ai/mafi-retrieval";
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
import type { ChatMessage, ChatMode } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
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
      mode,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
      mode: ChatMode;
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

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        if (mode === "default") {
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
              await enrichUsage({
                usage,
                dataStream,
                modelId: myProvider.languageModel(selectedChatModel).modelId,
                setFinalUsage: (value) => {
                  finalMergedUsage = value;
                },
              });
            },
          });

          result.consumeStream();

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            })
          );

          return;
        }

        await handleArchiveMode({
          dataStream,
          message,
          mode,
          selectedChatModel,
          userId: session.user?.id ?? undefined,
          setFinalUsage: (value) => {
            finalMergedUsage = value;
          },
        });
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

type EnrichUsageArgs = {
  usage: AppUsage;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId?: string | null;
  setFinalUsage: (usage: AppUsage) => void;
};

async function enrichUsage({
  usage,
  dataStream,
  modelId,
  setFinalUsage,
}: EnrichUsageArgs) {
  try {
    if (!modelId) {
      setFinalUsage(usage);
      dataStream.write({ type: "data-usage", data: usage });
      return;
    }

    const providers = await getTokenlensCatalog();

    if (!providers) {
      setFinalUsage(usage);
      dataStream.write({ type: "data-usage", data: usage });
      return;
    }

    const summary = getUsage({ modelId, usage, providers });
    const merged = { ...usage, ...summary, modelId } as AppUsage;
    setFinalUsage(merged);
    dataStream.write({ type: "data-usage", data: merged });
  } catch (err) {
    console.warn("TokenLens enrichment failed", err);
    setFinalUsage(usage);
    dataStream.write({ type: "data-usage", data: usage });
  }
}

type HandleArchiveModeArgs = {
  dataStream: UIMessageStreamWriter<ChatMessage>;
  message: ChatMessage;
  mode: ChatMode;
  selectedChatModel: ChatModel["id"];
  userId?: string;
  setFinalUsage: (usage: AppUsage) => void;
};

async function handleArchiveMode({
  dataStream,
  message,
  mode,
  selectedChatModel,
  userId,
  setFinalUsage,
}: HandleArchiveModeArgs) {
  const question = extractUserMessageText(message);
  const query = question || "Exploración del archivo MAFI";

  const shotContext = await retrieveRelevantShots(query, { limit: 15 });

  const contextForModel = shotContext.map((shot, index) => ({
    orden: index + 1,
    id: shot.id,
    slug: shot.slug,
    title: shot.title,
    vimeoUrl: shot.vimeoUrl,
    description: shot.description,
    place: shot.place,
    author: shot.author,
    date: shot.date,
    tags: shot.tags,
  }));

  const modeInstruction = AGENTE_FILMICO_MODE_APPENDIX[mode];

  const promptSegments = [
    `Pregunta del usuario:\n${question || query}`,
    modeInstruction ? `Modo activado:\n${modeInstruction}` : undefined,
    contextForModel.length
      ? `Planos disponibles del archivo (usa solo estos identificadores y URLs):\n${JSON.stringify(
          contextForModel,
          null,
          2
        )}`
      : `No se recuperaron planos relevantes. Explica la limitación y aclara cualquier información externa al archivo MAFI si decides incluirla.`,
  ].filter(Boolean);

  const result = await streamObject({
    model: myProvider.languageModel(selectedChatModel),
    system: AGENTE_FILMICO_SYSTEM_PROMPT,
    schema: mafiAnswerSchema,
    prompt: promptSegments.join("\n\n"),
  });

  const answer = await result.object;
  const usage = (await result.usage) as AppUsage;

  await enrichUsage({
    usage,
    dataStream,
    modelId: myProvider.languageModel(selectedChatModel).modelId,
    setFinalUsage,
  });

  const contextById = new Map<string, MafiShotContext>(
    shotContext.map((shot) => [shot.id, shot])
  );
  const contextBySlug = new Map<string, MafiShotContext>(
    shotContext.map((shot) => [shot.slug, shot])
  );

  const playlistShots = answer.shots.map((shot) => {
    const context =
      contextById.get(shot.id) ?? contextBySlug.get(shot.slug) ?? null;

    return {
      id: shot.id,
      slug: shot.slug || context?.slug || shot.id,
      title: context?.title ?? shot.title,
      vimeoUrl: context?.vimeoUrl ?? shot.vimeoUrl,
      recommendedStartSeconds: shot.recommendedStartSeconds,
      recommendedEndSeconds: shot.recommendedEndSeconds,
      reason: shot.reason,
      tags: shot.tags ?? context?.tags ?? undefined,
      author: context?.author ?? null,
      place: context?.place ?? null,
      date: context?.date ?? null,
    };
  });

  const playlistTitle = createPlaylistTitle(question);
  let documentId: string | undefined;

  if (userId) {
    documentId = generateUUID();
    await saveDocument({
      id: documentId,
      title: playlistTitle,
      kind: "mafi-playlist",
      userId,
      content: JSON.stringify({
        question,
        generalComment: answer.generalComment,
        shots: playlistShots,
        followUpSuggestions: answer.followUpSuggestions,
      }),
    });

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
      data: playlistTitle,
      transient: true,
    });
    dataStream.write({ type: "data-clear", data: null, transient: true });
    dataStream.write({ type: "data-finish", data: null, transient: true });
  }

  const shotLines = playlistShots.map((shot, index) => {
    const timeRange = formatTimecodeRange(
      shot.recommendedStartSeconds,
      shot.recommendedEndSeconds
    );

    const lines = [
      `${index + 1}. ${shot.title}${timeRange ? ` (${timeRange})` : ""}`,
      `   ${shot.reason}`,
      `   Vimeo: ${shot.vimeoUrl}`,
    ];

    return lines.join("\n");
  });

  const followUps = answer.followUpSuggestions
    .map((suggestion) => `- ${suggestion}`)
    .join("\n");

  const assistantSegments = [
    answer.generalComment,
    shotLines.length ? `Planos sugeridos:\n${shotLines.join("\n\n")}` : undefined,
    followUps ? `Para seguir investigando:\n${followUps}` : undefined,
    documentId
      ? "Abrí una playlist curada en el panel lateral para revisar los planos recomendados."
      : undefined,
  ].filter(Boolean) as string[];

  const assistantMessage = assistantSegments.join("\n\n");

  const responseId = generateUUID();
  const createdAtIso = new Date().toISOString();

  dataStream.write({
    type: "start",
    messageId: responseId,
    messageMetadata: { createdAt: createdAtIso },
  });
  dataStream.write({ type: "text-start", id: responseId });
  dataStream.write({ type: "text-delta", id: responseId, delta: assistantMessage });
  dataStream.write({ type: "text-end", id: responseId });
  dataStream.write({
    type: "finish",
    messageMetadata: { createdAt: createdAtIso },
  });
}

function extractUserMessageText(message: ChatMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

function createPlaylistTitle(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "Playlist del archivo MAFI";
  }

  const truncated =
    normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized;

  return `Playlist: ${truncated}`;
}

function formatTimecodeRange(
  start?: number,
  end?: number
): string | null {
  const segments: string[] = [];

  if (typeof start === "number" && Number.isFinite(start) && start >= 0) {
    segments.push(`inicio ${Math.floor(start)}s`);
  }

  if (typeof end === "number" && Number.isFinite(end) && end >= 0) {
    segments.push(`fin ${Math.floor(end)}s`);
  }

  if (segments.length === 0) {
    return null;
  }

  return segments.join(" · ");
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
