import { NextResponse } from "next/server"

import type { ProviderSettings } from "@/lib/evaluation/types"
import { discoverProviderModels } from "@/lib/server/gateway-client"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"
import { normalizeProviderSettings, ProviderSettingsError } from "@/lib/server/provider-settings"

interface ProviderModelsRequest {
  provider?: ProviderSettings
}

function providerErrorResponse(error: unknown) {
  if (error instanceof ProviderSettingsError || error instanceof PlatformSettingsError) {
    return NextResponse.json({ error: error.message, issues: error.issues }, { status: error.status })
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Provider model discovery failed." },
    { status: 502 },
  )
}

export async function GET() {
  try {
    const settings = await getActivePlatformSettings()
    return NextResponse.json(await discoverProviderModels(settings.provider))
  } catch (error) {
    return providerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProviderModelsRequest | null
  try {
    const settings = await getActivePlatformSettings()
    const providerSettings = body?.provider
      ? normalizeProviderSettings(body.provider, settings.provider)
      : settings.provider
    return NextResponse.json(await discoverProviderModels(providerSettings))
  } catch (error) {
    return providerErrorResponse(error)
  }
}
