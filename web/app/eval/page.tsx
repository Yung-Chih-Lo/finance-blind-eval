import { redirect } from "next/navigation"

interface EvalPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = "force-dynamic"

export default async function EvalPage({ searchParams }: EvalPageProps) {
  const params = await searchParams
  const legacyInvite = Array.isArray(params?.invite) ? params.invite[0] : params?.invite
  const newInvite = Array.isArray(params?.invite_code) ? params.invite_code[0] : params?.invite_code
  const inviteCode = newInvite || legacyInvite

  redirect(inviteCode ? `/?invite_code=${encodeURIComponent(inviteCode)}` : "/")
}
