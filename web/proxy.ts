import { NextResponse, type NextRequest } from "next/server"

import {
  ADMIN_AUTH_EXCHANGE_PATH,
  ADMIN_SESSION_COOKIE_NAME,
  hasAdminAuthConfiguration,
  validateAdminSessionCookie,
} from "@/lib/server/admin-auth"

function unauthorized() {
  return new NextResponse("Admin authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Finance Blind Evaluation Admin"',
    },
  })
}

function forbiddenWhenUnconfigured() {
  return new NextResponse("Admin authentication is required in production.", { status: 503 })
}

function decodeBasicAuth(header: string | null) {
  if (!header?.startsWith("Basic ")) {
    return undefined
  }

  try {
    const decoded = atob(header.slice("Basic ".length))
    const separator = decoded.indexOf(":")
    if (separator < 0) {
      return undefined
    }
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    }
  } catch {
    return undefined
  }
}

function hasValidBasicAuth(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return false
  }

  const credentials = decodeBasicAuth(request.headers.get("authorization"))
  return Boolean(credentials && credentials.password === adminPassword)
}

function redirectToExchange(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return undefined
  }

  const url = request.nextUrl.clone()
  url.pathname = ADMIN_AUTH_EXCHANGE_PATH
  url.search = ""
  url.searchParams.set("token", token)
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname === ADMIN_AUTH_EXCHANGE_PATH) {
    return NextResponse.next()
  }

  const exchangeRedirect = pathname === "/admin" ? redirectToExchange(request) : undefined
  if (exchangeRedirect) {
    return exchangeRedirect
  }

  if (!hasAdminAuthConfiguration()) {
    return process.env.NODE_ENV === "production" ? forbiddenWhenUnconfigured() : NextResponse.next()
  }

  if (await validateAdminSessionCookie(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.next()
  }

  if (!hasValidBasicAuth(request)) {
    return unauthorized()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
