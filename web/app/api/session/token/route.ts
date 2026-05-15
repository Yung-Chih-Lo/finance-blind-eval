import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Public token allocation is disabled. Redeem an invite code through /api/session/redeem-invite." },
    { status: 410 },
  )
}
