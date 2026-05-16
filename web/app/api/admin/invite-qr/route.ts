import QRCode from "qrcode"
import { NextResponse } from "next/server"

import { getSharedInviteCode } from "@/lib/server/shared-invite"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const code = getSharedInviteCode()
  if (!code) {
    return NextResponse.json({ error: "尚未設定共用邀請碼。" }, { status: 503 })
  }

  const url = new URL(request.url)
  const link = `${url.origin}/?invite_code=${encodeURIComponent(code)}`
  const qrSvg = await QRCode.toString(link, {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "svg",
    width: 320,
  })

  return NextResponse.json({ code, link, qrSvg })
}
