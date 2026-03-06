import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { upsertShotWithEmbeddings } from "@/lib/db/admin-shots";
import {
  bulkRowToApiPayload,
  parseCsvToShots,
  parseXlsxToShots,
} from "@/lib/shots-bulk-io";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  let file: File;
  let format: "csv" | "xlsx" = "csv";

  try {
    const formData = await request.formData();
    const uploaded = formData.get("file");
    const formatParam = formData.get("format");

    if (!uploaded || !(uploaded instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded. Use form field 'file'." },
        { status: 400 }
      );
    }

    file = uploaded;
    const ext = file.name.toLowerCase().slice(-4);
    if (formatParam === "xlsx" || ext === ".xlsx") {
      format = "xlsx";
    } else {
      format = "csv";
    }
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows =
      format === "xlsx" ? parseXlsxToShots(buffer) : parseCsvToShots(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found. Each row needs slug and title." },
        { status: 400 }
      );
    }

    const results: { slug: string; ok: boolean; error?: string }[] = [];

    for (const row of rows) {
      try {
        const payload = bulkRowToApiPayload(row);
        await upsertShotWithEmbeddings(payload);
        results.push({ slug: payload.slug, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ slug: row.slug, ok: false, error: msg });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      imported: okCount,
      failed: failCount,
      total: rows.length,
      results,
    });
  } catch (error) {
    console.error("Shots import error:", error);
    return NextResponse.json(
      { error: "Failed to import shots" },
      { status: 500 }
    );
  }
}
