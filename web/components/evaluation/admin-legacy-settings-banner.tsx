"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"

type BannerKind = "legacy-provider" | "validation-failed"

interface AdminLegacySettingsBannerProps {
  issues: string[]
  kind?: BannerKind
}

const BANNER_COPY: Record<BannerKind, { title: string; body: string }> = {
  "legacy-provider": {
    title: "偵測到舊版 provider 設定格式",
    body: "系統偵測到先前儲存的 provider 設定使用了舊版 schema。請重新儲存設定，或按下方「重置為環境變數預設值」一鍵清除舊欄位。",
  },
  "validation-failed": {
    title: "偵測到舊版問卷設定格式",
    body: "持久化的 platform settings 檔案使用了已停用的欄位或選項（例如已移除的 facet）。請按下方按鈕重置為預設值，重新啟用後再依現行欄位重新儲存設定。",
  },
}

export function AdminLegacySettingsBanner({ issues, kind = "legacy-provider" }: AdminLegacySettingsBannerProps) {
  const copy = BANNER_COPY[kind]
  const router = useRouter()
  const toast = useToast()
  const [isResetting, setIsResetting] = useState(false)

  async function handleReset() {
    setIsResetting(true)
    try {
      const response = await fetch("/api/admin/settings/reset", { method: "POST" })
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string; issues?: string[] } | null
        const text = [detail?.error, ...(detail?.issues ?? [])].filter(Boolean).join(" ") || "Reset 失敗，請重試或檢查 server log。"
        toast.error(text)
        return
      }
      toast.success("Provider 設定已重置為環境變數預設值。")
      router.push("/admin?tab=provider")
    } catch {
      toast.error("Reset 失敗，請確認網路後重試。")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section
      aria-live="assertive"
      className="admin-tokens m-4 rounded-md border border-[var(--admin-warning,#c43)] bg-[var(--admin-warning-bg,#fff4f4)] p-5 text-[var(--admin-fg)]"
    >
      <h2 className="text-base font-semibold">{copy.title}</h2>
      <p className="mt-2 text-sm">{copy.body}</p>
      {issues.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-sm">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4">
        <Button type="button" onClick={handleReset} disabled={isResetting}>
          {isResetting ? "重置中…" : "重置為環境變數預設值"}
        </Button>
      </div>
    </section>
  )
}
