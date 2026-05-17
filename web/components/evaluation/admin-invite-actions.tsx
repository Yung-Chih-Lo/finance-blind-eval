"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"

interface InviteQrData {
  code: string
  link: string
  qrSvg: string
}

export function AdminInviteActions() {
  const toast = useToast()
  const [data, setData] = useState<InviteQrData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function load() {
      setIsLoading(true)
      try {
        const response = await fetch("/api/admin/invite-qr", { cache: "no-store" })
        const payload = (await response.json().catch(() => null)) as
          | (Partial<InviteQrData> & { error?: string })
          | null
        if (!isMounted) {
          return
        }
        if (!response.ok || !payload?.code || !payload.qrSvg || !payload.link) {
          setData(null)
          setError(payload?.error || "無法載入邀請碼。")
          return
        }
        setData({ code: payload.code, link: payload.link, qrSvg: payload.qrSvg })
        setError(null)
      } catch {
        if (isMounted) {
          setData(null)
          setError("無法載入邀請碼，請確認網路後重試。")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [])

  function downloadSvg() {
    if (!data) {
      return
    }
    const blob = new Blob([data.qrSvg], { type: "image/svg+xml" })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = downloadUrl
    anchor.download = "invite-qr.svg"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(downloadUrl)
    toast.success("QR Code SVG 已下載。")
  }

  return (
    <section className="table-section invite-admin-panel">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">Invite</p>
          <h2>共用邀請碼與 QR Code</h2>
        </div>
      </div>
      {isLoading ? (
        <p>載入中…</p>
      ) : error ? (
        <p style={{ color: "var(--admin-warning, #c43)" }}>{error}</p>
      ) : data ? (
        <div className="invite-grid">
          <article className="invite-card">
            <div dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
            <strong>{data.code}</strong>
            <a href={data.link}>{data.link}</a>
            <Button type="button" onClick={downloadSvg}>
              下載 SVG
            </Button>
          </article>
        </div>
      ) : null}
    </section>
  )
}
