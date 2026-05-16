import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { createAnonymousParticipantSession } from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"
import { setSessionCookie } from "@/lib/server/session"
import { compareInviteCode, getSharedInviteCode } from "@/lib/server/shared-invite"

interface RedeemInviteRequest {
  inviteCode?: string
}

export const EVAL_COMPLETED_COOKIE = "eval_completed"

export async function POST(request: Request) {
  const settingsResult = await getActivePlatformSettings().catch((error) => error)
  if (settingsResult instanceof Error) {
    if (settingsResult instanceof PlatformSettingsError) {
      return NextResponse.json({ error: settingsResult.message, issues: settingsResult.issues }, { status: settingsResult.status })
    }
    return NextResponse.json({ error: "Platform settings could not be loaded." }, { status: 500 })
  }

  if (!getSharedInviteCode()) {
    return NextResponse.json(
      { error: "尚未設定共用邀請碼，請聯絡研究人員。" },
      { status: 503 },
    )
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

  const completedCookie = (await cookies()).get(EVAL_COMPLETED_COOKIE)?.value
  if (completedCookie === "1") {
    return NextResponse.json({ error: "本裝置已完成測驗。" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as RedeemInviteRequest | null
  const inviteCode = body?.inviteCode || ""

  if (!compareInviteCode(inviteCode)) {
    return NextResponse.json({ error: "邀請碼不正確。" }, { status: 403 })
  }

  try {
    const { participant, sessionToken } = await createAnonymousParticipantSession()
    const response = NextResponse.json({ participant, answeredCount: 0 })
    setSessionCookie(response, sessionToken)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "無法建立測驗 session，請稍後再試。" },
      { status: 500 },
    )
  }
}
