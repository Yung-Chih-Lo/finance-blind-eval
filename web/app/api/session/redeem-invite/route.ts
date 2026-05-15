import { NextResponse } from "next/server"

import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { redeemInviteCode } from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"
import { setSessionCookie } from "@/lib/server/session"

interface RedeemInviteRequest {
  inviteCode?: string
}

export async function POST(request: Request) {
  const settingsResult = await getActivePlatformSettings().catch((error) => error)
  if (settingsResult instanceof Error) {
    if (settingsResult instanceof PlatformSettingsError) {
      return NextResponse.json({ error: settingsResult.message, issues: settingsResult.issues }, { status: settingsResult.status })
    }
    return NextResponse.json({ error: "Platform settings could not be loaded." }, { status: 500 })
  }

  const clientIp = getClientIp(request)
  const ipLimit = checkRateLimit(
    `invite:ip:${clientIp}`,
    settingsResult.config.limits.rateLimit.inviteRedeemPerIpPerHour,
    60 * 60 * 1000,
  )
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "邀請碼嘗試次數過多，請稍後再試。" }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as RedeemInviteRequest | null
  const inviteCode = body?.inviteCode || ""

  try {
    const { participant, sessionToken } = await redeemInviteCode(inviteCode)
    const response = NextResponse.json({ participant, answeredCount: 0 })
    setSessionCookie(response, sessionToken)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "邀請碼驗證失敗，請稍後再試。" },
      { status: 403 },
    )
  }
}
