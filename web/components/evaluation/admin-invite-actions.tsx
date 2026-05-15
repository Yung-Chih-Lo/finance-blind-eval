"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"

interface GeneratedInvite {
  code: string
  link: string
  qrSvg: string
  invite: {
    id: string
    label?: string
  }
}

export function AdminInviteActions() {
  const toast = useToast()
  const [count, setCount] = useState(20)
  const [baseUrl, setBaseUrl] = useState("")
  const [invites, setInvites] = useState<GeneratedInvite[]>([])
  const [isLoading, setIsLoading] = useState(false)

  async function generateInvites() {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, baseUrl: baseUrl.trim() || undefined }),
      })
      const data = (await response.json()) as {
        invites?: GeneratedInvite[]
        error?: string
      }
      if (!response.ok || !data.invites) {
        throw new Error(data.error || "邀請碼產生失敗。")
      }
      setInvites(data.invites)
      toast.success(`已產生 ${data.invites.length} 組邀請碼。`)
    } catch (generateError) {
      toast.error(
        generateError instanceof Error
          ? generateError.message
          : "邀請碼產生失敗。"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="table-section invite-admin-panel">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">Invites</p>
          <h2>邀請碼與 QR Code</h2>
        </div>
      </div>
      <div className="invite-form">
        <label>
          產生數量
          <input
            min={1}
            max={200}
            type="number"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>
        <label>
          公開網址
          <input
            value={baseUrl}
            placeholder="例如：https://your-domain.com"
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <Button disabled={isLoading} type="button" onClick={generateInvites}>
          {isLoading ? "產生中..." : "產生邀請碼"}
        </Button>
      </div>
      {invites.length ? (
        <div className="invite-grid">
          {invites.map((invite) => (
            <article className="invite-card" key={invite.invite.id}>
              <div dangerouslySetInnerHTML={{ __html: invite.qrSvg }} />
              <p>{invite.invite.label}</p>
              <strong>{invite.code}</strong>
              <a href={invite.link}>{invite.link}</a>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
