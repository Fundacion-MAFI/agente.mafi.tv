import { NextResponse } from "next/server";
import { isEmbeddingModelId } from "@/lib/ai/embedding-models";
import { requireAdmin } from "@/lib/auth/admin";
import { purgeEmbeddingsForModel } from "@/lib/db/admin-embeddings";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await request.json()) as { modelId?: string };
    const modelId = body.modelId;

    if (typeof modelId !== "string" || !isEmbeddingModelId(modelId)) {
      return NextResponse.json(
        { error: "Invalid or missing modelId" },
        { status: 400 }
      );
    }

    const { deleted } = await purgeEmbeddingsForModel(modelId);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error("Purge embeddings error:", error);
    return NextResponse.json(
      { error: "Failed to purge embeddings" },
      { status: 500 }
    );
  }
}
