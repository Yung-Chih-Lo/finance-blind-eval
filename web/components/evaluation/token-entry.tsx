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
        toast.error(payload?.error || "無法開始問卷，請再試一次。")
        return
      }

      onStart(payload.participant, payload.answeredCount ?? 0)
    } catch {
      toast.error("無法開始問卷，請確認網路後再試一次。")
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
          <p className="lede">{config.study.rootDescription}</p>
        </div>

        {initialInviteCode ? (
          <div className="invite-prefilled-banner" role="status">
            ✓ 邀請碼已自動填入。閱讀完下方說明後，捲到底部點「開始問卷」即可。
          </div>
        ) : null}

        <div className="study-letter study-briefing" aria-label="研究問卷說明">
          <section className="brief-section">
            <h2>研究目的</h2>
            <p>{config.study.intro.paragraphs[0]}</p>
          </section>

          <dl className="brief-facts" aria-label="問卷摘要">
            <div>
              <dt>時間</dt>
              <dd>約 8-12 分鐘</dd>
            </div>
            <div>
              <dt>題數</dt>
              <dd>{config.limits.maxQuestionsPerParticipant} 題金融問題</dd>
            </div>
            <div>
              <dt>比較方式</dt>
              <dd>A / B / C 匿名盲測</dd>
            </div>
            <div>
              <dt>資料用途</dt>
              <dd>論文量化與質性分析</dd>
            </div>
          </dl>

          <section className="brief-section">
            <h2>你需要完成的事</h2>
            <ol>
              {config.study.intro.tasks.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ol>
          </section>

          <section className="brief-section brief-warning">
            <h2>作答前請注意</h2>
            {config.study.intro.paragraphs.slice(1).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>

          <section className="study-signature" aria-label="研究者資訊">
            <p>{config.study.signature.studentName}</p>
            <p>{config.study.signature.affiliation}</p>
            <p>{config.study.signature.advisor}</p>
            <p>
              <strong>Thesis Title:</strong>{" "}
              {config.study.signature.thesisTitle}
            </p>
          </section>
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
            <small className="invite-hint">不分大小寫</small>
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
              {isStarting ? "驗證中" : "開始問卷"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
