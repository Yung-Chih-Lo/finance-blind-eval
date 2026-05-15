import { NextResponse } from "next/server"

import { getAdminSnapshot } from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings } from "@/lib/server/platform-settings"

export async function GET() {
  const settings = await getActivePlatformSettings()
  return NextResponse.json(await getAdminSnapshot(settings.config))
}
