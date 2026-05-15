import { NextResponse } from "next/server"

import { PlatformSettingsError, resetPlatformSettings } from "@/lib/server/platform-settings"

export async function POST() {
  try {
    return NextResponse.json(await resetPlatformSettings("admin-reset"))
  } catch (error) {
    if (error instanceof PlatformSettingsError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: error.status })
    }
    return NextResponse.json({ error: "Platform settings reset failed." }, { status: 500 })
  }
}
