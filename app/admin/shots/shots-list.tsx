"use client";

import { parse } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Shot = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  vimeoUrl: string | null;
  date: string | null;
  place: string | null;
  author: string | null;
  geotag: string | null;
  tags: string[];
};

type SortKey = "title" | "place" | "date";
type SortDir = "asc" | "desc";

const SPANISH_DATE_FORMATS = [
  "d 'de' MMMM 'de' yyyy",
  "d 'de' MMM 'de' yyyy",
  "d/M/yyyy",
  "yyyy-MM-dd",
] as const;

function parseDateForSort(date: string | null): number {
  if (!date?.trim()) {
    return Number.NEGATIVE_INFINITY;
  }
  for (const fmt of SPANISH_DATE_FORMATS) {
    try {
      const parsed = parse(date.trim(), fmt, new Date(), { locale: es });
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
    } catch {
      continue;
    }
  }
  try {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  } catch {
    // fall through
  }
  return 0;
}

function SortButton({
  active,
  direction,
  onClick,
}: {
  active: boolean;
  direction: SortDir | null;
  onClick: () => void;
}) {
  return (
    <Button
      className="h-6 w-6 p-0"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      type="button"
      variant="ghost"
    >
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}

export function ShotsList() {
  const router = useRouter();
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetch("/api/admin/shots")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch");
        }
        return res.json();
      })
      .then(setShots)
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const filteredAndSorted = useMemo(() => {
    const filtered = search.trim()
      ? shots.filter((s) =>
          s.title.toLowerCase().includes(search.trim().toLowerCase())
        )
      : shots;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") {
        cmp = (a.title ?? "").localeCompare(b.title ?? "");
      } else if (sortKey === "place") {
        cmp = (a.place ?? "").localeCompare(b.place ?? "");
      } else {
        const aTime = parseDateForSort(a.date);
        const bTime = parseDateForSort(b.date);
        if (aTime !== bTime) {
          cmp = aTime - bTime;
        } else {
          cmp = (a.date ?? "").localeCompare(b.date ?? "");
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [shots, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading shots…</p>;
  }

  if (error) {
    return <p className="text-destructive">Failed to load shots: {error}</p>;
  }

  if (shots.length === 0) {
    return (
      <p className="text-muted-foreground">
        No shots yet.{" "}
        <Link className="underline" href="/admin/shots/new">
          Add one
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title…"
          value={search}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-1">
                  <span>Title</span>
                  <SortButton
                    active={sortKey === "title"}
                    direction={sortKey === "title" ? sortDir : null}
                    onClick={() => handleSort("title")}
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-1">
                  <span>Location</span>
                  <SortButton
                    active={sortKey === "place"}
                    direction={sortKey === "place" ? sortDir : null}
                    onClick={() => handleSort("place")}
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <SortButton
                    active={sortKey === "date"}
                    direction={sortKey === "date" ? sortDir : null}
                    onClick={() => handleSort("date")}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((shot) => (
              <tr
                key={shot.id}
                className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => router.push(`/admin/shots/${shot.slug}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/admin/shots/${shot.slug}`);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <td className="px-4 py-3">
                  <Link
                    className="font-medium hover:underline"
                    href={`/admin/shots/${shot.slug}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shot.title}
                  </Link>
                </td>
                <td className="text-muted-foreground px-4 py-3 text-sm">
                  {shot.place ?? "—"}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-sm">
                  {shot.date ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSorted.length === 0 && search.trim() && (
        <p className="text-muted-foreground text-sm">
          No shots match &quot;{search}&quot;
        </p>
      )}
    </div>
  );
}
