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
 * Normalization strips two character classes:
 *   - `\s` — whitespace (space, NBSP U+00A0, ideographic space U+3000, ...)
 *   - `\p{Cf}` — format chars (ZERO WIDTH SPACE U+200B, BOM U+FEFF, RTL marks, ...)
 * ECMAScript's `\s` does NOT include U+200B / U+FEFF because they're in
 * category Cf, not Zs — so both classes are needed to handle text pasted
 * from styled docs, chat apps, or IME-injected zero-widths.
 *
 * Comparison is case-insensitive. Case-folding is safe because the code is
 * public (printed beside the QR) and the input field already up-cases on
 * every keystroke — server-side fold is defense-in-depth.
 *
 * Returns false (not throws) when the env var is unset: the redeem route is
 * responsible for the 503 path before calling here.
 */
export function matchesSharedInviteCode(submitted: string): boolean {
  const expected = getSharedInviteCode()
  if (!expected) {
    return false
  }
  const normalize = (value: string) => value.replace(/[\s\p{Cf}]+/gu, "").toUpperCase()
  return normalize(submitted) === normalize(expected)
}
