"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/toast";

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

export function SettingsForm() {
  const [settings, setSettings] = useState<AdminSettingsMap | null>(null);
  const [defaults, setDefaults] = useState<AdminSettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load settings");
        return res.json();
      })
      .then((data) => {
        setSettings(data.settings ?? {});
        setDefaults(data.defaults ?? {});
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const updateLocal = (key: string, value: string | number | boolean) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const updateArray = (key: string, value: string) => {
    const arr = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setSettings((prev) => (prev ? { ...prev, [key]: arr } : null));
  };

  const handleSave = async () => {
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
      toast({ type: "success", description: "Settings saved" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

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
      <section>
        <h2 className="font-medium text-lg mb-4">Prompts</h2>
        <div className="space-y-4">
          {PROMPT_KEYS.map((key) => (
            <div key={key} className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={key}>{PROMPT_LABELS[key]}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => resetPrompt(key)}
                >
                  Reset to default
                </Button>
              </div>
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

      <section>
        <h2 className="font-medium text-lg mb-4">Embedding & Chunking</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Re-ingest required for changes to take effect.
        </p>
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
      </section>

      <section>
        <h2 className="font-medium text-lg mb-4">Retrieval</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="retrieval.timeout_ms">Timeout (ms)</Label>
            <Input
              id="retrieval.timeout_ms"
              min={1000}
              onChange={(e) =>
                updateLocal(
                  "retrieval.timeout_ms",
                  Number.parseInt(e.target.value, 10) || 12_000
                )
              }
              type="number"
              value={String(settings["retrieval.timeout_ms"] ?? 12_000)}
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
          </div>
          <div>
            <Label htmlFor="retrieval.cache_max_entries">Cache max entries</Label>
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
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-medium text-lg mb-4">Chat</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="chat.archivo_retrieval_timeout_ms">
              Archivo retrieval timeout (ms)
            </Label>
            <Input
              id="chat.archivo_retrieval_timeout_ms"
              min={1000}
              onChange={(e) =>
                updateLocal(
                  "chat.archivo_retrieval_timeout_ms",
                  Number.parseInt(e.target.value, 10) || 12_000
                )
              }
              type="number"
              value={String(settings["chat.archivo_retrieval_timeout_ms"] ?? 12_000)}
            />
          </div>
          <div>
            <Label htmlFor="chat.archivo_playlist_timeout_ms">
              Archivo playlist timeout (ms)
            </Label>
            <Input
              id="chat.archivo_playlist_timeout_ms"
              min={1000}
              onChange={(e) =>
                updateLocal(
                  "chat.archivo_playlist_timeout_ms",
                  Number.parseInt(e.target.value, 10) || 28_000
                )
              }
              type="number"
              value={String(settings["chat.archivo_playlist_timeout_ms"] ?? 28_000)}
            />
          </div>
          <div>
            <Label htmlFor="chat.step_count">Max tool-call steps per turn</Label>
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

      <section>
        <h2 className="font-medium text-lg mb-4">Entitlements</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-sm mb-2">Guest</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
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
                <Label htmlFor="entitlements.guest.available_chat_model_ids">
                  Available models (comma-separated)
                </Label>
                <Input
                  id="entitlements.guest.available_chat_model_ids"
                  onChange={(e) =>
                    updateArray(
                      "entitlements.guest.available_chat_model_ids",
                      e.target.value
                    )
                  }
                  placeholder="chat-model, film-agent"
                  value={
                    Array.isArray(
                      settings["entitlements.guest.available_chat_model_ids"]
                    )
                      ? (
                          settings[
                            "entitlements.guest.available_chat_model_ids"
                          ] as string[]
                        ).join(", ")
                      : "chat-model, film-agent"
                  }
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-medium text-sm mb-2">Regular</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
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
              <div>
                <Label htmlFor="entitlements.regular.available_chat_model_ids">
                  Available models (comma-separated)
                </Label>
                <Input
                  id="entitlements.regular.available_chat_model_ids"
                  onChange={(e) =>
                    updateArray(
                      "entitlements.regular.available_chat_model_ids",
                      e.target.value
                    )
                  }
                  placeholder="chat-model, film-agent"
                  value={
                    Array.isArray(
                      settings[
                        "entitlements.regular.available_chat_model_ids"
                      ]
                    )
                      ? (
                          settings[
                            "entitlements.regular.available_chat_model_ids"
                          ] as string[]
                        ).join(", ")
                      : "chat-model, film-agent"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-medium text-lg mb-4">Ingestion</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Throttle settings for when ingestion is triggered. See{" "}
          <a className="underline" href="/admin/ingest">
            /admin/ingest
          </a>{" "}
          to run ingestion.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <input
              checked={settings["ingest.throttle_enabled"] === true}
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
            <Label htmlFor="ingest.throttle_delay_ms">Throttle delay (ms)</Label>
            <Input
              id="ingest.throttle_delay_ms"
              min={0}
              onChange={(e) =>
                updateLocal(
                  "ingest.throttle_delay_ms",
                  Number.parseInt(e.target.value, 10) || 2000
                )
              }
              type="number"
              value={String(settings["ingest.throttle_delay_ms"] ?? 2000)}
            />
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
