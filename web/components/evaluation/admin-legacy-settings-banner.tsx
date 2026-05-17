"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"

interface AdminLegacySettingsBannerProps {
  message: string
  issues: string[]
}

export function AdminLegacySettingsBanner({ message, issues }: AdminLegacySettingsBannerProps) {
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
      router.refresh()
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
      <h2 className="text-base font-semibold">偵測到舊版 provider 設定格式</h2>
      <p className="mt-2 text-sm">{message}</p>
      {issues.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-sm">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-sm">
        請重新儲存設定，或按下方「重置為環境變數預設值」一鍵清除舊欄位。
      </p>
      <div className="mt-4">
        <Button type="button" onClick={handleReset} disabled={isResetting}>
          {isResetting ? "重置中…" : "重置為環境變數預設值"}
        </Button>
      </div>
    </section>
  )
}
