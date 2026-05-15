import { NextResponse } from "next/server"

import {
  ADMIN_SESSION_COOKIE_NAME,
  adminSessionCookieOptions,
  createAdminSessionCookieValue,
  hasAdminLinkTokenConfiguration,
  validateAdminLinkToken,
} from "@/lib/server/admin-auth"

interface ExchangeRequest {
  token?: string
}

function missingConfiguration() {
  return NextResponse.json({ error: "Admin link token is not configured." }, { status: 503 })
}

function invalidToken() {
  return NextResponse.json({ error: "Invalid admin token." }, { status: 401 })
}

async function createSessionResponse(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, await createAdminSessionCookieValue(), adminSessionCookieOptions())
  return response
}

function requestOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (!host) {
    return new URL(request.url).origin
  }
  const protocol = request.headers.get("x-forwarded-proto") || "http"
  return `${protocol}://${host}`
}

export async function GET(request: Request) {
  if (!hasAdminLinkTokenConfiguration()) {
    return missingConfiguration()
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token") || ""
  if (!(await validateAdminLinkToken(token))) {
    return invalidToken()
  }

  return createSessionResponse(NextResponse.redirect(new URL("/admin", requestOrigin(request))))
}

export async function POST(request: Request) {
  if (!hasAdminLinkTokenConfiguration()) {
    return missingConfiguration()
  }

  const body = (await request.json().catch(() => null)) as ExchangeRequest | null
  if (!(await validateAdminLinkToken(body?.token || ""))) {
    return invalidToken()
  }

  return createSessionResponse(NextResponse.json({ ok: true }))
}
