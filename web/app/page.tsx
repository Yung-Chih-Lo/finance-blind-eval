import { cookies } from "next/headers"

import { CompletionPage } from "@/components/evaluation/completion-page"
import { EvaluationApp } from "@/components/evaluation/evaluation-app"
import { getActivePlatformSettings } from "@/lib/server/platform-settings"

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const EVAL_COMPLETED_COOKIE = "eval_completed"

export const dynamic = "force-dynamic"

export default async function HomePage({ searchParams }: HomePageProps) {
  const settings = await getActivePlatformSettings()
  const cookieStore = await cookies()
  const isCompleted = cookieStore.get(EVAL_COMPLETED_COOKIE)?.value === "1"

  if (isCompleted) {
    return <CompletionPage config={settings.config} />
  }

  const params = await searchParams
  const inviteCodeParam = params?.invite_code
  const inviteCode = Array.isArray(inviteCodeParam) ? inviteCodeParam[0] : inviteCodeParam

  return <EvaluationApp config={settings.config} initialInviteCode={inviteCode || ""} />
}
