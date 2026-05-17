import "server-only"

/**
 * Returns the configured shared invite code (trimmed), or `null` when the env
 * var is unset or empty. Callers MUST treat `null` as a service-configuration
 * error (HTTP 503) — without it, no participant can be admitted.
 */
export function getSharedInviteCode(): string | null {
  const value = process.env.SHARED_INVITE_CODE?.trim()
  return value && value.length > 0 ? value : null
}

/**
 * Whether `submitted` matches the configured shared invite code.
 *
 * Comparison is case-insensitive and strips ALL Unicode whitespace (including
 * NBSP / ZWSP / BOM) so participants pasting the code from styled documents
 * or chat apps don't get silently rejected. Case-folding is safe because the
 * code is public (printed beside the QR) and the input field already
 * up-cases on every keystroke — server-side fold is defense-in-depth.
 *
 * Returns false (not throws) when the env var is unset: the redeem route is
 * responsible for the 503 path before calling here.
 */
export function matchesSharedInviteCode(submitted: string): boolean {
  const expected = getSharedInviteCode()
  if (!expected) {
    return false
  }
  const normalize = (value: string) => value.replace(/\s+/gu, "").toUpperCase()
  return normalize(submitted) === normalize(expected)
}
