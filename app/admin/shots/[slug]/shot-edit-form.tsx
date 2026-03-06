"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAdminDirty } from "@/app/admin/admin-dirty-context";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMarkdownToShot, shotToMarkdown } from "@/lib/shot-markdown";

function normalizeTagsForCompare(tags: string | string[]): string {
  const arr = (
    typeof tags === "string"
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : (tags ?? []).map((t) => String(t).trim()).filter(Boolean)
  ).sort();
  return arr.join(",");
}

const EMBEDDING_MODEL_LABELS: Record<string, string> = {
  "openai/text-embedding-3-small": "OpenAI 3 Small",
  "openai/text-embedding-3-large": "OpenAI 3 Large",
  "mistral/mistral-embed": "Mistral Embed",
  "google/gemini-embedding-001": "Google Gemini",
  "google/text-multilingual-embedding-002": "Google Multilingual 002",
  "google/text-embedding-005": "Google Embedding 005",
  "alibaba/qwen3-embedding-4b": "Alibaba Qwen3 4B",
  "amazon/titan-embed-text-v2": "Amazon Titan v2",
};

function extractVimeoId(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const id = segments.at(-1) ?? null;
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

type ShotData = {
  slug: string;
  title: string;
  description: string | null;
  historicContext: string | null;
  aestheticCriticalCommentary: string | null;
  productionCommentary: string | null;
  vimeoUrl: string | null;
  date: string | null;
  place: string | null;
  author: string | null;
  geotag: string | null;
  tags: string[];
};

export function ShotEditForm({
  slug,
  initialData,
}: {
  slug: string | null;
  initialData: ShotData | null;
}) {
  const router = useRouter();
  const dirtyContext = useAdminDirty();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveHandlerRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const initialForm = {
    slug: slug ?? "",
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    historicContext: initialData?.historicContext ?? "",
    aestheticCriticalCommentary: initialData?.aestheticCriticalCommentary ?? "",
    productionCommentary: initialData?.productionCommentary ?? "",
    vimeoUrl: initialData?.vimeoUrl ?? "",
    date: initialData?.date ?? "",
    place: initialData?.place ?? "",
    author: initialData?.author ?? "",
    geotag: initialData?.geotag ?? "",
    tags: (initialData?.tags ?? []).join(", "),
  };

  const [form, setForm] = useState(initialForm);

  const isDirty =
    form.slug !== initialForm.slug ||
    form.title !== initialForm.title ||
    form.description !== initialForm.description ||
    form.historicContext !== initialForm.historicContext ||
    form.aestheticCriticalCommentary !==
      initialForm.aestheticCriticalCommentary ||
    form.productionCommentary !== initialForm.productionCommentary ||
    form.vimeoUrl !== initialForm.vimeoUrl ||
    form.date !== initialForm.date ||
    form.place !== initialForm.place ||
    form.author !== initialForm.author ||
    form.geotag !== initialForm.geotag ||
    normalizeTagsForCompare(form.tags) !==
      normalizeTagsForCompare(initialForm.tags);

  useEffect(() => {
    dirtyContext?.setDirty(isDirty);
  }, [isDirty, dirtyContext]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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

  const doSave = async (): Promise<string | undefined> => {
    setSaving(true);
    setError(null);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        slug: form.slug || undefined,
        title: form.title,
        description: form.description || null,
        historicContext: form.historicContext || null,
        aestheticCriticalCommentary: form.aestheticCriticalCommentary || null,
        productionCommentary: form.productionCommentary || null,
        vimeoUrl: form.vimeoUrl || null,
        date: form.date || null,
        place: form.place || null,
        author: form.author || null,
        geotag: form.geotag || null,
        tags,
      };

      if (slug) {
        const res = await fetch(`/api/admin/shots/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to update");
        }
        if (data.warning) {
          toast({ type: "warning", description: data.warning });
        } else {
          const modelLabel =
            typeof data.embeddingModel === "string"
              ? (EMBEDDING_MODEL_LABELS[data.embeddingModel] ??
                data.embeddingModel)
              : "selected model";
          toast({
            type: "success",
            description: `Shot updated & embeddings regenerated for ${modelLabel}.`,
          });
        }
        return;
      }

      const finalSlug = form.slug.trim() || "new-shot";
      const res = await fetch("/api/admin/shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, slug: finalSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create");
      }
      if (data.warning) {
        toast({ type: "warning", description: data.warning });
      } else {
        const modelLabel =
          typeof data.embeddingModel === "string"
            ? (EMBEDDING_MODEL_LABELS[data.embeddingModel] ??
              data.embeddingModel)
            : "selected model";
        toast({
          type: "success",
          description: `Shot created & embeddings generated for ${modelLabel}.`,
        });
      }
      return data.slug as string;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    saveHandlerRef.current = async () => {
      await doSave();
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSlug = await doSave();
      dirtyContext?.setDirty(false);
      if (slug) {
        router.push("/admin/shots");
      } else {
        router.push(`/admin/shots/${newSlug ?? "new-shot"}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!slug || !confirm("Delete this shot? This cannot be undone.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/shots/${slug}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete");
      }
      if (data.warning) {
        toast({ type: "warning", description: data.warning });
      }
      router.push("/admin/shots");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const vimeoId = extractVimeoId(form.vimeoUrl);

  return (
    <form className="max-w-2xl space-y-4" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="vimeoUrl">Vimeo URL</Label>
        <Input
          id="vimeoUrl"
          onChange={(e) => setForm((f) => ({ ...f, vimeoUrl: e.target.value }))}
          placeholder="https://vimeo.com/..."
          type="url"
          value={form.vimeoUrl}
        />
        {vimeoId && (
          <div className="aspect-video overflow-hidden rounded-md border border-input bg-muted">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              src={`https://player.vimeo.com/video/${vimeoId}`}
              title="Vimeo video player"
            />
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Shot title"
          required
          value={form.title}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          id="description"
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Shot description"
          rows={10}
          value={form.description}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="historicContext">Historic context</Label>
        <textarea
          className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          id="historicContext"
          onChange={(e) =>
            setForm((f) => ({ ...f, historicContext: e.target.value }))
          }
          placeholder="Historical or contextual background for this shot"
          rows={10}
          value={form.historicContext}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="aestheticCriticalCommentary">
          Aesthetic-critical commentary
        </Label>
        <textarea
          className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          id="aestheticCriticalCommentary"
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              aestheticCriticalCommentary: e.target.value,
            }))
          }
          placeholder="Aesthetic and critical analysis of the shot"
          rows={10}
          value={form.aestheticCriticalCommentary}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="productionCommentary">Production commentary</Label>
        <textarea
          className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          id="productionCommentary"
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              productionCommentary: e.target.value,
            }))
          }
          placeholder="Production context, techniques, or technical notes"
          rows={10}
          value={form.productionCommentary}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            placeholder="1 de septiembre de 2010"
            value={form.date}
          />
        </div>
        <div>
          <Label htmlFor="place">Place</Label>
          <Input
            id="place"
            onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
            placeholder="Santiago"
            value={form.place}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="author">Author</Label>
          <Input
            id="author"
            onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
            placeholder="Ignacio Rojas"
            value={form.author}
          />
        </div>
        <div>
          <Label htmlFor="geotag">Geotag (lat, lon)</Label>
          <Input
            id="geotag"
            onChange={(e) => setForm((f) => ({ ...f, geotag: e.target.value }))}
            placeholder="-33.442662, -70.653916"
            value={form.geotag}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">Slug (filename)</Label>
        <Input
          disabled={!!slug}
          id="slug"
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="42"
          required={!slug}
          value={form.slug}
        />
        {slug && (
          <p className="text-muted-foreground text-xs">
            Slug cannot be changed after creation
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          placeholder="bicentenario, bandera"
          value={form.tags}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-dashed p-4">
        <h3 className="font-medium text-sm">Markdown</h3>
        <p className="text-muted-foreground text-xs">
          Export this shot as Markdown or paste Markdown to update the form.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const md = shotToMarkdown({
                slug: form.slug || undefined,
                title: form.title,
                description: form.description || null,
                historicContext: form.historicContext || null,
                aestheticCriticalCommentary:
                  form.aestheticCriticalCommentary || null,
                productionCommentary: form.productionCommentary || null,
                vimeoUrl: form.vimeoUrl || null,
                date: form.date || null,
                place: form.place || null,
                author: form.author || null,
                geotag: form.geotag || null,
                tags: form.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              });
              const blob = new Blob([md], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${form.slug || "shot"}.md`;
              a.click();
              URL.revokeObjectURL(url);
              toast({ type: "success", description: "Markdown downloaded." });
            }}
            type="button"
            variant="outline"
          >
            Export to Markdown
          </Button>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="markdown-paste">Update from Markdown</Label>
          <textarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            id="markdown-paste"
            placeholder="Paste Markdown with YAML frontmatter here, then click Apply…"
            rows={6}
          />
          <Button
            onClick={() => {
              const textarea = document.getElementById(
                "markdown-paste"
              ) as HTMLTextAreaElement | null;
              const md = textarea?.value?.trim();
              if (!md) {
                toast({
                  type: "error",
                  description: "Paste Markdown first.",
                });
                return;
              }
              const parsed = parseMarkdownToShot(md);
              const hasUpdates = Object.keys(parsed).length > 0;
              if (hasUpdates) {
                setForm((f) => ({
                  ...f,
                  title: parsed.title ?? f.title,
                  description: parsed.description ?? f.description ?? "",
                  historicContext:
                    parsed.historicContext ?? f.historicContext ?? "",
                  aestheticCriticalCommentary:
                    parsed.aestheticCriticalCommentary ??
                    f.aestheticCriticalCommentary ??
                    "",
                  productionCommentary:
                    parsed.productionCommentary ?? f.productionCommentary ?? "",
                  vimeoUrl: parsed.vimeoUrl ?? f.vimeoUrl ?? "",
                  date: parsed.date ?? f.date ?? "",
                  place: parsed.place ?? f.place ?? "",
                  author: parsed.author ?? f.author ?? "",
                  geotag: parsed.geotag ?? f.geotag ?? "",
                  tags: (parsed.tags ?? []).join(", "),
                }));
                toast({
                  type: "success",
                  description: "Form updated from Markdown.",
                });
                if (textarea) textarea.value = "";
              } else {
                toast({
                  type: "error",
                  description: "Could not parse Markdown. Check the format.",
                });
              }
            }}
            type="button"
            variant="secondary"
          >
            Apply Markdown
          </Button>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button disabled={saving} type="submit">
          {saving ? "Saving…" : slug ? "Update" : "Create"}
        </Button>
        <Button
          onClick={() => dirtyContext?.requestNavigation("/admin/shots")}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        {slug && (
          <Button
            disabled={saving}
            onClick={handleDelete}
            type="button"
            variant="destructive"
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
