import { NextResponse } from "next/server"

import { exportPlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"

export async function GET() {
  try {
    return new NextResponse(`${JSON.stringify(await exportPlatformSettings(), null, 2)}\n`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="platform-settings.json"',
      },
    })
  } catch (error) {
    if (error instanceof PlatformSettingsError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: error.status })
    }
    return NextResponse.json({ error: "Platform settings export failed." }, { status: 500 })
  }
}
