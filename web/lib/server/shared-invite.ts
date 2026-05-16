import "server-only"

export function getSharedInviteCode(): string | null {
  const value = process.env.SHARED_INVITE_CODE?.trim()
  return value && value.length > 0 ? value : null
}

export function compareInviteCode(submitted: string): boolean {
  const expected = getSharedInviteCode()
  if (!expected) {
    return false
  }
  return submitted.trim().toUpperCase() === expected.toUpperCase()
}
