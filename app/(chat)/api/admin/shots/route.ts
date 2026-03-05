import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listShots, upsertShotWithEmbeddings } from "@/lib/db/admin-shots";
import { syncShotToGitHub } from "@/lib/github/sync-shot";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
    const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);

    const shots = await listShots({
      limit: Math.min(limit, 100),
      offset,
    });
    return NextResponse.json(shots);
  } catch (error) {
    console.error("Admin list shots error:", error);
    return NextResponse.json(
      { error: "Failed to list shots" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  let body: {
    slug: string;
    title: string;
    description?: string | null;
    historicContext?: string | null;
    vimeoUrl?: string | null;
    date?: string | null;
    place?: string | null;
    author?: string | null;
    geotag?: string | null;
    tags?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, title } = body;
  if (!slug?.trim() || !title?.trim()) {
    return NextResponse.json(
      { error: "slug and title are required" },
      { status: 400 }
    );
  }

  const slugSafe = slug.trim().replace(/[^a-zA-Z0-9-_]/g, "-");
  if (!slugSafe) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const shot = await upsertShotWithEmbeddings({
      slug: slugSafe,
      title: title.trim(),
      description: body.description ?? null,
      historicContext: body.historicContext ?? null,
      vimeoUrl: body.vimeoUrl ?? null,
      date: body.date ?? null,
      place: body.place ?? null,
      author: body.author ?? null,
      geotag: body.geotag ?? null,
      tags: body.tags ?? [],
    });

    const sync = await syncShotToGitHub(shot, "create");
    if (!sync.ok) {
      console.warn("GitHub sync failed after DB update:", sync.error);
      return NextResponse.json(
        {
          shot,
          warning: `Shot saved to DB but GitHub sync failed: ${sync.error}`,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(shot, { status: 201 });
  } catch (error) {
    console.error("Admin create shot error:", error);
    return NextResponse.json(
      { error: "Failed to create shot" },
      { status: 500 }
    );
  }
}
