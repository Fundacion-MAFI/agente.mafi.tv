"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export function ShotsList() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <ul className="divide-y rounded-md border">
      {shots.map((shot) => (
        <li key={shot.id}>
          <Link
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
            href={`/admin/shots/${shot.slug}`}
          >
            <div>
              <span className="font-medium">{shot.title}</span>
              {shot.place && (
                <span className="ml-2 text-muted-foreground text-sm">
                  — {shot.place}
                </span>
              )}
            </div>
            <span className="text-muted-foreground text-sm">{shot.slug}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
