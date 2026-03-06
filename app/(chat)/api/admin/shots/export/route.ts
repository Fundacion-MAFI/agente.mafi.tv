import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listShots } from "@/lib/db/admin-shots";
import { type BulkShotRow, shotsToCsv, shotsToXlsx } from "@/lib/shots-bulk-io";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const validFormat = format === "xlsx" ? "xlsx" : "csv";

  try {
    const shots = await listShots({ limit: 10_000 });
    const rows: BulkShotRow[] = shots.map((s) => ({
      slug: s.slug,
      title: s.title,
      description: s.description ?? null,
      historic_context: s.historicContext ?? null,
      aesthetic_critical_commentary: s.aestheticCriticalCommentary ?? null,
      production_commentary: s.productionCommentary ?? null,
      vimeo_url: s.vimeoUrl ?? null,
      date: s.date ?? null,
      place: s.place ?? null,
      author: s.author ?? null,
      geotag: s.geotag ?? null,
      tags: (s.tags ?? []).join(", "),
    }));

    if (validFormat === "xlsx") {
      const buffer = shotsToXlsx(rows);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="shots-export-${Date.now()}.xlsx"`,
        },
      });
    }

    const csv = shotsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="shots-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("Shots export error:", error);
    return NextResponse.json(
      { error: "Failed to export shots" },
      { status: 500 }
    );
  }
}
