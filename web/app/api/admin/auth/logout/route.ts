import { NextResponse } from "next/server"

import { ADMIN_SESSION_COOKIE_NAME, clearedAdminSessionCookieOptions } from "@/lib/server/admin-auth"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", clearedAdminSessionCookieOptions())
  return response
}

