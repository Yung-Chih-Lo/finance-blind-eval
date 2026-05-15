import { NextResponse } from "next/server"

import {
  getActivePlatformSettings,
  PlatformSettingsError,
  savePlatformSettings,
} from "@/lib/server/platform-settings"
import { ProviderSettingsError } from "@/lib/server/provider-settings"

function settingsErrorResponse(error: unknown) {
  if (error instanceof PlatformSettingsError || error instanceof ProviderSettingsError) {
    return NextResponse.json({ error: error.message, issues: error.issues }, { status: error.status })
  }
  return NextResponse.json({ error: "Platform settings request failed." }, { status: 500 })
}

export async function GET() {
  try {
    return NextResponse.json(await getActivePlatformSettings())
  } catch (error) {
    return settingsErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  const payload = await request.json().catch(() => null)
  try {
    const saved = await savePlatformSettings(payload, "admin")
    return NextResponse.json(saved)
  } catch (error) {
    return settingsErrorResponse(error)
  }
}
