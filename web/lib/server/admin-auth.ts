export const ADMIN_SESSION_COOKIE_NAME = "admin_session"
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60
export const ADMIN_AUTH_EXCHANGE_PATH = "/api/admin/auth/exchange"

const TEXT_ENCODER = new TextEncoder()

function base64UrlEncode(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? TEXT_ENCODER.encode(value) : value
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, TEXT_ENCODER.encode(value))
  return base64UrlEncode(new Uint8Array(signature))
}

function configuredAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_LINK_TOKEN_SHA256?.trim() ||
    process.env.ADMIN_LINK_TOKEN?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    ""
  )
}

export function hasAdminAuthConfiguration() {
  return Boolean(
    process.env.ADMIN_LINK_TOKEN_SHA256?.trim() ||
      process.env.ADMIN_LINK_TOKEN?.trim() ||
      process.env.ADMIN_PASSWORD?.trim(),
  )
}

export function hasAdminLinkTokenConfiguration() {
  return Boolean(process.env.ADMIN_LINK_TOKEN_SHA256?.trim() || process.env.ADMIN_LINK_TOKEN?.trim())
}

export async function validateAdminLinkToken(token: string) {
  const candidate = token.trim()
  if (!candidate) {
    return false
  }

  const expectedHash = process.env.ADMIN_LINK_TOKEN_SHA256?.trim().toLowerCase()
  if (expectedHash) {
    return constantTimeEqual(await sha256Hex(candidate), expectedHash)
  }

  const expectedRaw = process.env.ADMIN_LINK_TOKEN?.trim()
  return Boolean(expectedRaw && constantTimeEqual(candidate, expectedRaw))
}

export async function createAdminSessionCookieValue(now = Date.now()) {
  const secret = configuredAdminSessionSecret()
  if (!secret) {
    throw new Error("Admin session secret is not configured.")
  }

  const payload = base64UrlEncode(
    JSON.stringify({
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + ADMIN_SESSION_TTL_SECONDS,
      nonce: crypto.randomUUID(),
    }),
  )
  const signature = await hmacSha256(payload, secret)
  return `${payload}.${signature}`
}

export async function validateAdminSessionCookie(value?: string) {
  if (!value) {
    return false
  }

  const secret = configuredAdminSessionSecret()
  if (!secret) {
    return false
  }

  const [payload, signature] = value.split(".")
  if (!payload || !signature) {
    return false
  }

  const expectedSignature = await hmacSha256(payload, secret)
  if (!constantTimeEqual(signature, expectedSignature)) {
    return false
  }

  try {
    const decoded = new TextDecoder().decode(base64UrlDecode(payload))
    const parsed = JSON.parse(decoded) as { exp?: number; iat?: number }
    const nowSeconds = Math.floor(Date.now() / 1000)
    return Number.isFinite(parsed.exp) && Number.isFinite(parsed.iat) && parsed.iat! <= nowSeconds + 60 && parsed.exp! > nowSeconds
  } catch {
    return false
  }
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  }
}

export function clearedAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }
}

