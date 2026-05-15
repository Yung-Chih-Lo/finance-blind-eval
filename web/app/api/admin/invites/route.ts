import QRCode from "qrcode"
import { NextResponse } from "next/server"

import { createInviteCodes, getInviteCodes } from "@/lib/server/evaluation-storage"

interface CreateInvitesRequest {
  count?: number
  baseUrl?: string
  labelPrefix?: string
  maxUses?: number
  expiresAt?: string
}

function getBaseUrl(request: Request, value?: string) {
  if (value?.trim()) {
    return value.trim().replace(/\/$/, "")
  }
  const url = new URL(request.url)
  return url.origin
}

export async function GET() {
  return NextResponse.json({ invites: await getInviteCodes() })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateInvitesRequest | null
  const count = Math.min(Math.max(Number(body?.count || 1), 1), 200)
  const baseUrl = getBaseUrl(request, body?.baseUrl)
  const created = await createInviteCodes(count, {
    labelPrefix: body?.labelPrefix?.trim() || "invite",
    maxUses: Math.min(Math.max(Number(body?.maxUses || 1), 1), 20),
    expiresAt: body?.expiresAt,
  })

  const invites = await Promise.all(
    created.map(async ({ code, invite }) => {
      const link = `${baseUrl}/eval?invite=${encodeURIComponent(code)}`
      return {
        code,
        invite,
        link,
        qrSvg: await QRCode.toString(link, {
          errorCorrectionLevel: "M",
          margin: 2,
          type: "svg",
          width: 320,
        }),
      }
    }),
  )

  return NextResponse.json({ invites })
}
