import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "ingest-mafi-shots.ts"
  );

  return new Promise<NextResponse>((resolve) => {
    const child = spawn("npx", ["tsx", scriptPath], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(
          NextResponse.json({
            ok: true,
            message: "Ingestion completed",
            output: stdout,
          })
        );
      } else {
        resolve(
          NextResponse.json(
            {
              error: "Ingestion failed",
              output: stdout,
              stderr,
              exitCode: code,
            },
            { status: 500 }
          )
        );
      }
    });

    child.on("error", (err) => {
      resolve(
        NextResponse.json(
          { error: "Failed to start ingestion", detail: String(err) },
          { status: 500 }
        )
      );
    });
  });
}
