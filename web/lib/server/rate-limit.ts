import "server-only"

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwardedFor || request.headers.get("x-real-ip") || "unknown"
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs }
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt }
  }

  current.count += 1
  return { ok: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt }
}
