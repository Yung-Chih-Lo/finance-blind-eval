import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { createAnonymousParticipantSession } from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"
import { EVAL_COMPLETED_COOKIE, setSessionCookie } from "@/lib/server/session"
import { getSharedInviteCode, matchesSharedInviteCode } from "@/lib/server/shared-invite"

interface RedeemInviteRequest {
  inviteCode?: unknown
}

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

  // Check the completion cookie BEFORE consuming the IP rate-limit bucket — a
  // completed user spamming the endpoint must not eat the quota of innocent
  // participants on the same NAT (lab, dorm, coffee shop).
  const completedCookie = (await cookies()).get(EVAL_COMPLETED_COOKIE)?.value
  if (completedCookie === "1") {
    return NextResponse.json({ error: "本裝置已完成問卷。" }, { status: 403 })
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
  // Guard against malformed bodies (e.g. inviteCode is an object/number)
  // which would otherwise crash matchesSharedInviteCode → 500 instead of 400.
  if (body !== null && body.inviteCode !== undefined && typeof body.inviteCode !== "string") {
    return NextResponse.json({ error: "邀請碼格式不正確。" }, { status: 400 })
  }
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode : ""

  if (!matchesSharedInviteCode(inviteCode)) {
    return NextResponse.json({ error: "邀請碼不正確。" }, { status: 403 })
  }

  try {
    const { participant, sessionToken } = await createAnonymousParticipantSession()
    const response = NextResponse.json({ participant, answeredCount: 0 })
    setSessionCookie(response, sessionToken)
    return response
  } catch (error) {
    // Log raw error server-side; respond generically so internal failure modes
    // (token allocation, file-write errors) aren't leaked to clients.
    console.error("redeem-invite: failed to create participant session", error)
    return NextResponse.json(
      { error: "無法建立問卷 session，請稍後再試。" },
      { status: 500 },
    )
  }
}
