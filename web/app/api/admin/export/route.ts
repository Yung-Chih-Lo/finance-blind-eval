import { NextResponse } from "next/server"

import { buildExportCsv, buildExportJson } from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings } from "@/lib/server/platform-settings"

export async function GET(request: Request) {
  const settings = await getActivePlatformSettings()
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "json"

  if (format === "csv") {
    return new NextResponse(await buildExportCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="finance-blind-eval.csv"',
      },
    })
  }

  if (format === "json") {
    return new NextResponse(await buildExportJson(settings), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="finance-blind-eval.json"',
      },
    })
  }

  return NextResponse.json({ error: "Unsupported export format." }, { status: 400 })
}
