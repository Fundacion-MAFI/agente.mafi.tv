"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminDirty } from "../admin-dirty-context";

const CHAT_MODELS = [
  { id: "xai/grok-4.1-fast-non-reasoning", label: "xAI Grok 4.1 Fast (non-reasoning)" },
  { id: "xai/grok-4.1-fast-reasoning", label: "xAI Grok 4.1 Fast (reasoning)" },
  { id: "openai/gpt-5.2", label: "OpenAI GPT-5.2" },
  { id: "openai/gpt-5.4", label: "OpenAI GPT-5.4" },
  { id: "openai/gpt-5-mini", label: "OpenAI GPT-5 Mini" },
  { id: "anthropic/claude-opus-4.6", label: "Anthropic Claude Opus 4.6" },
  { id: "anthropic/claude-sonnet-4.6", label: "Anthropic Claude Sonnet 4.6" },
  { id: "google/gemini-3-flash", label: "Google Gemini 3 Flash" },
  { id: "google/gemini-2.5-flash", label: "Google Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
] as const;

const CHAT_MODEL_IDS: readonly string[] = CHAT_MODELS.map((m) => m.id);

const EMBEDDING_MODELS = [
  { id: "openai/text-embedding-3-small", label: "OpenAI 3 Small (1536)" },
  { id: "openai/text-embedding-3-large", label: "OpenAI 3 Large (3072)" },
  { id: "mistral/mistral-embed", label: "Mistral Embed (1024)" },
  { id: "google/gemini-embedding-001", label: "Google Gemini (3072)" },
  {
    id: "google/text-multilingual-embedding-002",
    label: "Google Multilingual 002 (768)",
  },
  { id: "google/text-embedding-005", label: "Google Embedding 005 (768)" },
  { id: "alibaba/qwen3-embedding-4b", label: "Alibaba Qwen3 4B (2560)" },
  { id: "amazon/titan-embed-text-v2", label: "Amazon Titan v2 (1024)" },
] as const;

type AdminSettingsMap = Record<
  string,
  string | number | boolean | string[] | undefined
>;

const PROMPT_KEYS = [
  "prompts.agente_filmico",
  "prompts.regular",
  "prompts.artifacts",
  "prompts.code",
  "prompts.sheet",
  "prompts.title",
  "prompts.update_document",
] as const;

const PROMPT_LABELS: Record<(typeof PROMPT_KEYS)[number], string> = {
  "prompts.agente_filmico": "Agente Fílmico (Archivo curation)",
  "prompts.regular": "Regular assistant tone",
  "prompts.artifacts": "Artifacts / document creation",
  "prompts.code": "Python code generation",
  "prompts.sheet": "Spreadsheet creation",
  "prompts.title": "Chat title generation",
  "prompts.update_document":
    "Document update (use {mediaType} and {currentContent} as placeholders)",
};

const PROMPT_DESCRIPTIONS: Record<(typeof PROMPT_KEYS)[number], string> = {
  "prompts.agente_filmico":
    "Used when the user selects Agente Fílmico and asks a question about the MAFI archive. Produces a curatorial playlist from retrieved shots.",
  "prompts.regular":
    "Base tone for every message in regular chat mode (GPT-4o mini). Combined with artifacts and geo hints.",
  "prompts.artifacts":
    "Tells the model when to use createDocument and updateDocument. Shown on every message in regular chat.",
  "prompts.code":
    "Used when the model creates a Python code artifact (e.g. user asks “write a factorial function”).",
  "prompts.sheet":
    "Used when the model creates a spreadsheet artifact (e.g. user asks “create a CSV of expenses”).",
  "prompts.title":
    "Used once when the user sends the first message in a new chat. Generates a short title (≤80 chars).",
  "prompts.update_document":
    "Used when the user asks to modify an existing artifact (e.g. “fix this code” or “add a column”).",
};

type EmbeddingsStatus = {
  activeModel: string;
  shotCount: number;
  embeddingCount: number;
  isReady: boolean;
};

function shallowEqual(a: AdminSettingsMap, b: AdminSettingsMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const va = a[key];
    const vb = b[key];
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length || va.some((v, i) => v !== vb[i])) {
        return false;
      }
    } else if (va !== vb) {
      return false;
    }
  }
  return true;
}

export function SettingsForm() {
  const dirtyContext = useAdminDirty();
  const [settings, setSettings] = useState<AdminSettingsMap | null>(null);
  const [initialSettings, setInitialSettings] =
    useState<AdminSettingsMap | null>(null);
  const [defaults, setDefaults] = useState<AdminSettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embeddingsStatus, setEmbeddingsStatus] =
    useState<EmbeddingsStatus | null>(null);
  const saveHandlerRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const fetchEmbeddingsStatus = useCallback(async (model?: string) => {
    const params = model ? `?model=${encodeURIComponent(model)}` : "";
    const res = await fetch(`/api/admin/embeddings-status${params}`);
    if (res.ok) {
      const data = await res.json();
      setEmbeddingsStatus(data);
    } else {
      setEmbeddingsStatus(null);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load settings");
        return res.json();
      })
      .then((data) => {
        const s = data.settings ?? {};
        setSettings(s);
        setInitialSettings(s);
        setDefaults(data.defaults ?? {});
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const embeddingModel =
    settings?.["embedding.model"] ?? "openai/text-embedding-3-small";
  useEffect(() => {
    if (!loading) {
      fetchEmbeddingsStatus(
        typeof embeddingModel === "string" ? embeddingModel : undefined
      );
    }
  }, [loading, embeddingModel, fetchEmbeddingsStatus]);

  const isDirty =
    settings !== null &&
    initialSettings !== null &&
    !shallowEqual(settings, initialSettings);

  const setDirty = dirtyContext?.setDirty;
  useEffect(() => {
    setDirty?.(isDirty);
  }, [isDirty, setDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    saveHandlerRef.current = handleSave;
  });

  const registerSaveHandler = dirtyContext?.registerSaveHandler;
  const unregisterSaveHandler = dirtyContext?.unregisterSaveHandler;
  const clearDirty = dirtyContext?.setDirty;
  useEffect(() => {
    registerSaveHandler?.(() => saveHandlerRef.current());
    return () => {
      unregisterSaveHandler?.();
      clearDirty?.(false);
    };
  }, [registerSaveHandler, unregisterSaveHandler, clearDirty]);

  const updateLocal = (key: string, value: string | number | boolean) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setInitialSettings(settings);
      toast({ type: "success", description: "Settings saved" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  const resetPrompt = (key: string) => {
    const def = defaults?.[key];
    if (typeof def === "string") {
      updateLocal(key, def);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  if (error || !settings) {
    return (
      <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
        {error ?? "Failed to load settings"}
      </div>
    );
  }

  return (
    <form
      className="max-w-3xl space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <section className="overflow-hidden rounded-lg border">
        <h2 className="bg-muted px-4 py-3 font-medium text-lg">Prompts</h2>
        <div className="space-y-4 p-4">
          {PROMPT_KEYS.map((key) => (
            <div className="grid gap-2" key={key}>
              <div className="flex items-center justify-between">
                <Label htmlFor={key}>{PROMPT_LABELS[key]}</Label>
                <Button
                  onClick={() => resetPrompt(key)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Reset to default
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {PROMPT_DESCRIPTIONS[key]}
              </p>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                id={key}
                onChange={(e) => updateLocal(key, e.target.value)}
                rows={key === "prompts.agente_filmico" ? 12 : 6}
                value={
                  typeof settings[key] === "string"
                    ? (settings[key] as string)
                    : ""
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <h2 className="bg-muted px-4 py-3 font-medium text-lg">
          Embedding & Chunking
        </h2>
        <div className="space-y-4 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="embedding.model">Retrieval model</Label>
              <Select
                onValueChange={(value) => updateLocal("embedding.model", value)}
                value={String(
                  settings["embedding.model"] ?? "openai/text-embedding-3-small"
                )}
              >
                <SelectTrigger className="w-[280px]" id="embedding.model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {EMBEDDING_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {embeddingsStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-sm ${
                    embeddingsStatus.isReady
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {embeddingsStatus.isReady ? (
                    <>
                      <span aria-hidden>✓</span>
                      {embeddingsStatus.embeddingCount} shots
                    </>
                  ) : (
                    <>
                      <span aria-hidden>⚠</span>
                      {embeddingsStatus.embeddingCount}/
                      {embeddingsStatus.shotCount} shots
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="embedding.chunk_size">Chunk size</Label>
              <Input
                id="embedding.chunk_size"
                min={100}
                onChange={(e) =>
                  updateLocal(
                    "embedding.chunk_size",
                    Number.parseInt(e.target.value, 10) || 800
                  )
                }
                type="number"
                value={String(settings["embedding.chunk_size"] ?? 800)}
              />
            </div>
            <div>
              <Label htmlFor="embedding.chunk_overlap">Chunk overlap</Label>
              <Input
                id="embedding.chunk_overlap"
                min={0}
                onChange={(e) =>
                  updateLocal(
                    "embedding.chunk_overlap",
                    Number.parseInt(e.target.value, 10) || 200
                  )
                }
                type="number"
                value={String(settings["embedding.chunk_overlap"] ?? 200)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <h2 className="bg-muted px-4 py-3 font-medium text-lg">Retrieval</h2>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="retrieval.k">Shots per query (k)</Label>
            <Input
              id="retrieval.k"
              min={1}
              onChange={(e) =>
                updateLocal(
                  "retrieval.k",
                  Number.parseInt(e.target.value, 10) || 24
                )
              }
              type="number"
              value={String(settings["retrieval.k"] ?? 24)}
            />
          </div>
          <div>
            <Label htmlFor="retrieval.max_result_limit">Max result limit</Label>
            <Input
              id="retrieval.max_result_limit"
              min={1}
              onChange={(e) =>
                updateLocal(
                  "retrieval.max_result_limit",
                  Number.parseInt(e.target.value, 10) || 50
                )
              }
              type="number"
              value={String(settings["retrieval.max_result_limit"] ?? 50)}
            />
          </div>
          <div>
            <Label htmlFor="retrieval.cache_ttl_ms">Cache TTL (ms)</Label>
            <Input
              id="retrieval.cache_ttl_ms"
              min={0}
              onChange={(e) =>
                updateLocal(
                  "retrieval.cache_ttl_ms",
                  Number.parseInt(e.target.value, 10) || 300_000
                )
              }
              type="number"
              value={String(settings["retrieval.cache_ttl_ms"] ?? 300_000)}
            />
            <p className="mt-1 text-muted-foreground text-xs">
              How long cached retrieval results and query embeddings stay valid
              (ms). 0 = no caching.
            </p>
          </div>
          <div>
            <Label htmlFor="retrieval.cache_max_entries">
              Cache max entries
            </Label>
            <Input
              id="retrieval.cache_max_entries"
              min={1}
              onChange={(e) =>
                updateLocal(
                  "retrieval.cache_max_entries",
                  Number.parseInt(e.target.value, 10) || 128
                )
              }
              type="number"
              value={String(settings["retrieval.cache_max_entries"] ?? 128)}
            />
            <p className="mt-1 text-muted-foreground text-xs">
              Maximum number of cached queries. Oldest entries are evicted when
              full.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <h2 className="bg-muted px-4 py-3 font-medium text-lg">Chat</h2>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="chat.model">Agente Fílmico model</Label>
            <Select
              onValueChange={(value) =>
                updateLocal(
                  "chat.model",
                  value === "__custom__" ? "" : value
                )
              }
              value={
                CHAT_MODEL_IDS.includes(
                  String(settings["chat.model"] ?? "openai/gpt-5.2")
                )
                  ? String(settings["chat.model"] ?? "openai/gpt-5.2")
                  : "__custom__"
              }
            >
              <SelectTrigger className="w-[280px]" id="chat.model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {CHAT_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">Custom (enter below)</SelectItem>
              </SelectContent>
            </Select>
            {!CHAT_MODEL_IDS.includes(
              String(settings["chat.model"] ?? "")
            ) && (
              <Input
                className="mt-2 w-[280px] font-mono text-sm"
                onChange={(e) =>
                  updateLocal("chat.model", e.target.value.trim())
                }
                placeholder="provider/model-id"
                value={String(settings["chat.model"] ?? "")}
              />
            )}
            <p className="mt-1 text-muted-foreground text-xs">
              Model used for Archivo playlist generation.
            </p>
            <a
              className="mt-1 inline-block text-muted-foreground text-xs underline hover:text-foreground"
              href="https://vercel.com/pablos-projects-c370279e/agente-mafi-tv/ai-gateway/models?capabilities=text"
              rel="noopener noreferrer"
              target="_blank"
            >
              For more models →
            </a>
          </div>
          <div>
            <Label htmlFor="chat.step_count">
              Max tool-call steps per turn
            </Label>
            <Input
              id="chat.step_count"
              min={1}
              onChange={(e) =>
                updateLocal(
                  "chat.step_count",
                  Number.parseInt(e.target.value, 10) || 5
                )
              }
              type="number"
              value={String(settings["chat.step_count"] ?? 5)}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <h2 className="bg-muted px-4 py-3 font-medium text-lg">Entitlements</h2>
        <div className="grid gap-6 p-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium text-sm">Guest</h3>
            <Label htmlFor="entitlements.guest.max_messages_per_day">
              Max messages per day
            </Label>
            <Input
              id="entitlements.guest.max_messages_per_day"
              min={0}
              onChange={(e) =>
                updateLocal(
                  "entitlements.guest.max_messages_per_day",
                  Number.parseInt(e.target.value, 10) || 20
                )
              }
              type="number"
              value={String(
                settings["entitlements.guest.max_messages_per_day"] ?? 20
              )}
            />
          </div>
          <div>
            <h3 className="mb-2 font-medium text-sm">Regular</h3>
            <Label htmlFor="entitlements.regular.max_messages_per_day">
              Max messages per day
            </Label>
            <Input
              id="entitlements.regular.max_messages_per_day"
              min={0}
              onChange={(e) =>
                updateLocal(
                  "entitlements.regular.max_messages_per_day",
                  Number.parseInt(e.target.value, 10) || 100
                )
              }
              type="number"
              value={String(
                settings["entitlements.regular.max_messages_per_day"] ?? 100
              )}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <h2 className="bg-muted px-4 py-3 font-medium text-lg">Embedding</h2>
        <div className="space-y-4 p-4">
          <p className="text-muted-foreground text-sm">
            Throttle settings for embedding runs. See the{" "}
            <a className="underline" href="/admin/ingest">
              Embed page
            </a>{" "}
            to run embedding.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <input
                checked={settings["ingest.throttle_enabled"] !== false}
                id="ingest.throttle_enabled"
                onChange={(e) =>
                  updateLocal("ingest.throttle_enabled", e.target.checked)
                }
                type="checkbox"
              />
              <Label htmlFor="ingest.throttle_enabled">
                Enable throttling (delay between embedding calls)
              </Label>
            </div>
            <div>
              <Label htmlFor="ingest.throttle_delay_ms">
                Throttle delay (ms)
              </Label>
              <Input
                id="ingest.throttle_delay_ms"
                min={0}
                onChange={(e) =>
                  updateLocal(
                    "ingest.throttle_delay_ms",
                    Number.parseInt(e.target.value, 10) || 10_000
                  )
                }
                type="number"
                value={String(settings["ingest.throttle_delay_ms"] ?? 10_000)}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-3 pt-4">
        <Button disabled={saving} type="submit">
          {saving ? "Saving…" : "Save all"}
        </Button>
      </div>
    </form>
  );
}
