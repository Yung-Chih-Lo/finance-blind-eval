"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import type { ParticipantStatus, StudyConfig } from "@/lib/evaluation/types"

interface TokenEntryProps {
  config: StudyConfig
  initialInviteCode?: string
  onStart: (participant: ParticipantStatus, answeredCount: number) => void
}

export function TokenEntry({
  config,
  initialInviteCode = "",
  onStart,
}: TokenEntryProps) {
  const toast = useToast()
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [isStarting, setIsStarting] = useState(false)

  async function handleStart() {
    if (!inviteCode.trim()) {
      toast.info("請輸入研究人員提供的邀請碼。")
      return
    }

    setIsStarting(true)
    try {
      const response = await fetch("/api/session/redeem-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      })
      const payload = (await response.json().catch(() => null)) as {
        participant?: ParticipantStatus
        answeredCount?: number
        error?: string
      } | null

      if (!response.ok || !payload?.participant) {
        toast.error(payload?.error || "無法開始測驗，請再試一次。")
        return
      }

      onStart(payload.participant, payload.answeredCount ?? 0)
    } catch {
      toast.error("無法開始測驗，請確認網路後再試一次。")
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <main className="page-shell centered-page">
      <section className="entry-panel start-panel intro-panel">
        <div className="start-heading">
          <p className="eyebrow">{config.study.eyebrow}</p>
          <h1>{config.study.title}</h1>
        </div>

        {initialInviteCode ? (
          <div className="invite-prefilled-banner" role="status">
            ✓ 邀請碼已自動填入。閱讀完下方說明後，捲到底部點「開始測驗」即可。
          </div>
        ) : null}

        <div className="study-letter" aria-label="研究問卷說明">
          <p>{config.study.intro.greeting}</p>
          {config.study.intro.paragraphs.slice(0, 2).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <ol>
            {config.study.intro.tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ol>
          {config.study.intro.paragraphs.slice(2).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <div className="study-signature">
            <p>{config.study.signature.closing}</p>
            <p>{config.study.signature.studentName}</p>
            <p>{config.study.signature.affiliation}</p>
            <p>{config.study.signature.advisor}</p>
            <p>
              <strong>Thesis Title:</strong>{" "}
              {config.study.signature.thesisTitle}
            </p>
          </div>
        </div>

        <form
          className="invite-entry-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleStart()
          }}
        >
          <label>
            邀請碼
            <small className="invite-hint">不分大小寫，例如 AILAB502</small>
            <input
              autoComplete="one-time-code"
              value={inviteCode}
              placeholder="請輸入研究人員提供的邀請碼"
              onChange={(event) => {
                setInviteCode(event.target.value.toUpperCase())
              }}
            />
          </label>
          <div className="entry-actions">
            <Button type="submit" disabled={isStarting}>
              {isStarting ? "驗證中" : "開始測驗"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
