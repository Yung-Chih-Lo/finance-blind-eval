import { EvaluationApp } from "@/components/evaluation/evaluation-app"
import { getActivePlatformSettings } from "@/lib/server/platform-settings"

interface EvalPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = "force-dynamic"

export default async function EvalPage({ searchParams }: EvalPageProps) {
  const settings = await getActivePlatformSettings()
  const params = await searchParams
  const invite = Array.isArray(params?.invite) ? params.invite[0] : params?.invite

  return <EvaluationApp config={settings.config} initialInviteCode={invite || ""} />
}
