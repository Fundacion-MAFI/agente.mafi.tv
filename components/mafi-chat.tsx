"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateUUID } from "@/lib/utils";
import type { ShotRecommendation } from "@/lib/mafi/types";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  shots?: ShotRecommendation[];
};

type ApiMessage = {
  role: ChatRole;
  content: string;
};

type ApiResponse = {
  answer: string;
  shots: ShotRecommendation[];
};

const ShotCard = ({ shot }: { shot: ShotRecommendation }) => {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h4 className="text-lg font-semibold">{shot.shotTitle}</h4>
        <p className="text-sm text-muted-foreground">
          {shot.dir} · {shot.id}
        </p>
      </div>

      {shot.imageSrc && (
        <img
          src={shot.imageSrc}
          alt={shot.shotTitle}
          className="h-48 w-full rounded-md object-cover"
        />
      )}

      <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${shot.vimeoId}`}
          title={shot.shotTitle}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      {shot.reason && (
        <p className="text-sm text-muted-foreground">{shot.reason}</p>
      )}
    </div>
  );
};

export function MafiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading]);

  const conversation = useMemo<ApiMessage[]>(
    () =>
      messages.map(({ role, content }) => ({
        role,
        content,
      })),
    [messages]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: generateUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...conversation, { role: "user", content: userMessage.content }],
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error ?? "Something went wrong";
        throw new Error(message);
      }

      const payload = (await response.json()) as ApiResponse;
      const assistantMessage: ChatMessage = {
        id: generateUUID(),
        role: "assistant",
        content: payload.answer,
        shots: payload.shots,
      };

      setMessages((previous) => [...previous, assistantMessage]);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to fetch a response");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">MAFI Vimeo Chatbot</h1>
          <p className="text-sm text-muted-foreground">
            Ask about the MAFI archive and receive curated Vimeo shots.
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-6 overflow-y-auto rounded-lg border border-border bg-background p-4"
      >
        {messages.length === 0 && !isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <p className="max-w-sm text-base">
              Start a conversation to discover documentary plans and video
              references from the MAFI corpus.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-4">
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto max-w-xl bg-primary text-primary-foreground"
                    : "mr-auto max-w-2xl bg-muted"
                }`}
              >
                {message.content}
              </div>

              {message.role === "assistant" && message.shots?.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {message.shots.map((shot) => (
                    <ShotCard key={`${message.id}-${shot.id}`} shot={shot} />
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
            Thinking...
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about a theme, director, or topic..."
          className="min-h-24 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Generating" : "Ask"}
        </button>
      </form>
    </div>
  );
}
