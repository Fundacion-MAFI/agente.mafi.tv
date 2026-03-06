import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  deleteShotBySlug,
  getShotBySlug,
  upsertShotWithEmbeddings,
} from "@/lib/db/admin-shots";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  try {
    const shot = await getShotBySlug(slug);
    if (!shot) {
      return NextResponse.json({ error: "Shot not found" }, { status: 404 });
    }
    return NextResponse.json(shot);
  } catch (error) {
    console.error("Admin get shot error:", error);
    return NextResponse.json({ error: "Failed to get shot" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  let body: {
    title?: string;
    description?: string | null;
    historicContext?: string | null;
    aestheticCriticalCommentary?: string | null;
    productionCommentary?: string | null;
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

  const existing = await getShotBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: "Shot not found" }, { status: 404 });
  }

  const updates = {
    slug: existing.slug,
    title: body.title ?? existing.title,
    description:
      body.description !== undefined ? body.description : existing.description,
    historicContext:
      body.historicContext !== undefined
        ? body.historicContext
        : existing.historicContext,
    aestheticCriticalCommentary:
      body.aestheticCriticalCommentary !== undefined
        ? body.aestheticCriticalCommentary
        : existing.aestheticCriticalCommentary,
    productionCommentary:
      body.productionCommentary !== undefined
        ? body.productionCommentary
        : existing.productionCommentary,
    vimeoUrl: body.vimeoUrl !== undefined ? body.vimeoUrl : existing.vimeoUrl,
    date: body.date !== undefined ? body.date : existing.date,
    place: body.place !== undefined ? body.place : existing.place,
    author: body.author !== undefined ? body.author : existing.author,
    geotag: body.geotag !== undefined ? body.geotag : existing.geotag,
    tags: body.tags ?? existing.tags,
  };

  try {
    const shot = await upsertShotWithEmbeddings(updates);
    return NextResponse.json(shot);
  } catch (error) {
    console.error("Admin update shot error:", error);
    return NextResponse.json(
      { error: "Failed to update shot" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  try {
    const shot = await deleteShotBySlug(slug);
    if (!shot) {
      return NextResponse.json({ error: "Shot not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Shot deleted" });
  } catch (error) {
    console.error("Admin delete shot error:", error);
    return NextResponse.json(
      { error: "Failed to delete shot" },
      { status: 500 }
    );
  }
}
