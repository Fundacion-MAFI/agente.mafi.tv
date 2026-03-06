import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { shotsToCsv, shotsToXlsx } from "@/lib/shots-bulk-io";

const TEMPLATE_ROWS = [
  {
    slug: "example-shot-1",
    title: "Example shot title",
    description: "Optional description of the shot.",
    historic_context: "",
    aesthetic_critical_commentary: "",
    production_commentary: "",
    vimeo_url: "https://vimeo.com/123456789",
    date: "1 de septiembre de 2010",
    place: "Santiago",
    author: "Director name",
    geotag: "-33.442662, -70.653916",
    tags: "tag1, tag2",
  },
];

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
    if (validFormat === "xlsx") {
      const buffer = shotsToXlsx(TEMPLATE_ROWS);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="shots-template.xlsx"',
        },
      });
    }

    const csv = shotsToCsv(TEMPLATE_ROWS);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="shots-template.csv"',
      },
    });
  } catch (error) {
    console.error("Shots template error:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
