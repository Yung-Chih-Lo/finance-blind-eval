import { NextResponse } from "next/server"

import type { ProviderSettings } from "@/lib/evaluation/types"
import { previewProviderAnswers } from "@/lib/server/gateway-client"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"
import { normalizeProviderSettings, ProviderSettingsError } from "@/lib/server/provider-settings"

interface ProviderTestRequest {
  provider?: ProviderSettings
  question?: string
  promptCategoryId?: string
}

function providerErrorResponse(error: unknown) {
  if (error instanceof ProviderSettingsError || error instanceof PlatformSettingsError) {
    return NextResponse.json({ error: error.message, issues: error.issues }, { status: error.status })
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Provider preview failed." },
    { status: 502 },
  )
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProviderTestRequest | null
  try {
    const settings = await getActivePlatformSettings()
    const question = body?.question?.trim() || "請解釋殖利率曲線倒掛代表什麼，以及它不一定預測衰退的原因。"
    const category =
      settings.config.promptCategories.find((item) => item.id === body?.promptCategoryId) ??
      settings.config.promptCategories[0]
    if (!category) {
      return NextResponse.json({ error: "No prompt category is configured." }, { status: 400 })
    }

    const providerSettings = body?.provider
      ? normalizeProviderSettings(body.provider, settings.provider)
      : settings.provider

    return NextResponse.json(
      await previewProviderAnswers({
        providerSettings,
        answerLabels: settings.config.answerLabels,
        modelIds: settings.config.modelIds,
        category,
        question,
      }),
    )
  } catch (error) {
    return providerErrorResponse(error)
  }
}
