"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { chatModels } from "@/lib/ai/models";
import { STREAM_TROUBLESHOOTING_MESSAGE } from "@/lib/constants";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage, MessageMode } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

const STREAM_WATCHDOG_TIMEOUT_MS = 15_000;

type TelemetryCapableWindow = typeof window & {
  posthog?: { capture?: (event: string, properties?: Record<string, unknown>) => void };
  Sentry?: {
    captureMessage?: (
      message: string,
      context?: { extra?: Record<string, unknown> }
    ) => void;
  };
};

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const initialModel = chatModels.find((model) => model.id === initialChatModel);

  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [showStreamWatchdogAlert, setShowStreamWatchdogAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const [messageMode, setMessageMode] = useState<MessageMode>(
    initialModel?.forcedMode ?? "default"
  );
  const [lastStreamActivityAt, setLastStreamActivityAt] = useState<number | null>(null);
  const streamWatchdogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const handleModelChange = useCallback((modelId: string) => {
    setCurrentModelId(modelId);
    setMessageMode((prevMode) => {
      const selectedModel = chatModels.find((model) => model.id === modelId);

      if (selectedModel?.forcedMode) {
        return selectedModel.forcedMode;
      }

      return prevMode === "archivo" ? "default" : prevMode;
    });
  }, []);

  const handleModeChange = useCallback(
    (mode: MessageMode) => {
      if (mode === "archivo" && currentModelId !== "film-agent") {
        setCurrentModelId("film-agent");
      }

      setMessageMode(mode);
    },
    [currentModelId]
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setLastStreamActivityAt(Date.now());
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      setLastStreamActivityAt(null);
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      setLastStreamActivityAt(null);
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
        return;
      }

      toast({
        type: "error",
        description: STREAM_TROUBLESHOOTING_MESSAGE,
      });
    },
  });

  const clearStreamWatchdogTimeout = useCallback(() => {
    if (streamWatchdogTimeoutRef.current) {
      clearTimeout(streamWatchdogTimeoutRef.current);
      streamWatchdogTimeoutRef.current = null;
    }
  }, []);

  const logStreamWatchdogTelemetry = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const clientWindow = window as TelemetryCapableWindow;
    clientWindow.posthog?.capture?.("chat_stream_watchdog_timeout", {
      chatId: id,
      status,
    });

    clientWindow.Sentry?.captureMessage?.("chat_stream_watchdog_timeout", {
      extra: { chatId: id, status },
    });

    if (process.env.NODE_ENV !== "production") {
      console.warn("Chat stream watchdog timeout", { chatId: id, status });
    }
  }, [id, status]);

  const handleStreamWatchdogTimeout = useCallback(() => {
    clearStreamWatchdogTimeout();
    setLastStreamActivityAt(null);
    setShowStreamWatchdogAlert(true);
    logStreamWatchdogTelemetry();
    stop();
  }, [clearStreamWatchdogTimeout, logStreamWatchdogTelemetry, stop]);

  useEffect(() => {
    if (status !== "streaming" || showStreamWatchdogAlert) {
      clearStreamWatchdogTimeout();
      return;
    }

    streamWatchdogTimeoutRef.current = setTimeout(
      handleStreamWatchdogTimeout,
      STREAM_WATCHDOG_TIMEOUT_MS
    );

    return () => {
      clearStreamWatchdogTimeout();
    };
  }, [
    status,
    lastStreamActivityAt,
    showStreamWatchdogAlert,
    handleStreamWatchdogTimeout,
    clearStreamWatchdogTimeout,
  ]);

  const handleRetryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

    if (!lastUserMessage) {
      toast({ type: "error", description: "There isn't a previous message to retry." });
      return;
    }

    setShowStreamWatchdogAlert(false);
    sendMessage({
      role: "user",
      mode: lastUserMessage.mode ?? "default",
      parts: lastUserMessage.parts,
    });
  }, [messages, sendMessage]);

  const hasRetryableUserMessage = messages.some((message) => message.role === "user");

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        mode: "default",
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              onModelChange={handleModelChange}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              messageMode={messageMode}
              onModeChange={handleModeChange}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messageMode={messageMode}
        messages={messages}
        onModeChange={setMessageMode}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={setShowStreamWatchdogAlert}
        open={showStreamWatchdogAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check the API connection</AlertDialogTitle>
            <AlertDialogDescription>
              We stopped receiving data from the AI Gateway. Refresh the page or verify your
              API connection. You can also retry your last message below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              disabled={!hasRetryableUserMessage}
              onClick={handleRetryLastMessage}
            >
              Retry last message
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
