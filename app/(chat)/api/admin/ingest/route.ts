import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { runMafiIngest } from "@/lib/ingest/run-mafi-ingest";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  const prune = request.url.includes("prune=1") || request.url.includes("prune=true");

  const result = await runMafiIngest({ prune });

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      message: "Ingestion completed",
      output: result.output,
    });
  }

  return NextResponse.json(
    {
      error: result.error ?? "Ingestion failed",
      output: result.output,
      exitCode: 1,
    },
    { status: 500 }
  );
}
