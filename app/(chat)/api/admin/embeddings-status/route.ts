import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getEmbeddingsStatus,
  getEmbeddingsStatusAll,
} from "@/lib/db/admin-embeddings";

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
    const all = searchParams.get("all") === "1" || searchParams.get("all") === "true";
    if (all) {
      const status = await getEmbeddingsStatusAll();
      return NextResponse.json(status);
    }
    const model = searchParams.get("model") ?? undefined;
    const status = await getEmbeddingsStatus(model);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Embeddings status error:", error);
    return NextResponse.json(
      { error: "Failed to get embeddings status" },
      { status: 500 }
    );
  }
}
