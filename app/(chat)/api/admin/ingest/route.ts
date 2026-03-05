import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { runMafiIngest } from "@/lib/ingest/run-mafi-ingest";

export const maxDuration = 300;

function streamNdjsonLine(
  encoder: TextEncoder,
  obj: { type: string; [key: string]: unknown }
): Uint8Array {
  return encoder.encode(JSON.stringify(obj) + "\n");
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  const prune =
    request.url.includes("prune=1") || request.url.includes("prune=true");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const onLog = (line: string) => {
        controller.enqueue(
          streamNdjsonLine(encoder, { type: "log", line })
        );
      };

      try {
        const result = await runMafiIngest({ prune, onLog });
        controller.enqueue(
          streamNdjsonLine(encoder, {
            type: "done",
            ok: result.ok,
            output: result.output,
            filesProcessed: result.filesProcessed,
            embeddingsUpdated: result.embeddingsUpdated,
            pruned: result.pruned,
            error: result.error,
          })
        );
      } catch (err) {
        controller.enqueue(
          streamNdjsonLine(encoder, {
            type: "done",
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            output: "",
            filesProcessed: 0,
            embeddingsUpdated: 0,
            pruned: 0,
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
