"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    slug: slug ?? "",
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    historicContext: initialData?.historicContext ?? "",
    vimeoUrl: initialData?.vimeoUrl ?? "",
    date: initialData?.date ?? "",
    place: initialData?.place ?? "",
    author: initialData?.author ?? "",
    geotag: initialData?.geotag ?? "",
    tags: (initialData?.tags ?? []).join(", "),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      slug: form.slug || undefined,
      title: form.title,
      description: form.description || null,
      historicContext: form.historicContext || null,
      vimeoUrl: form.vimeoUrl || null,
      date: form.date || null,
      place: form.place || null,
      author: form.author || null,
      geotag: form.geotag || null,
      tags,
    };

    try {
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
        }
        router.push("/admin/shots");
        router.refresh();
      } else {
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
        }
        router.push(`/admin/shots/${data.slug}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
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

      <div className="flex gap-3 pt-4">
        <Button disabled={saving} type="submit">
          {saving ? "Saving…" : slug ? "Update" : "Create"}
        </Button>
        <Link href="/admin/shots">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
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
