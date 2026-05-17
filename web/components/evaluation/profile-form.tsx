"use client"

import { useState } from "react"

import { ScaleInput } from "@/components/evaluation/scale-input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import { SEEDED_PARTICIPANTS } from "@/lib/evaluation/config"
import type { ParticipantProfile } from "@/lib/evaluation/types"

interface ProfileFormProps {
  token: string
  onSubmit: (profile: ParticipantProfile) => void
}

export function ProfileForm({ token, onSubmit }: ProfileFormProps) {
  const toast = useToast()
  const seeded = SEEDED_PARTICIPANTS[token]
  const [profile, setProfile] = useState<ParticipantProfile>({
    token,
    knownName: seeded?.name,
    isBusinessOrFinance: "unsure",
    gradeOrOccupation: "",
    hasTakenFinanceCourse: "no",
    financeFamiliarity: 3,
    llmExperience: "rare",
    notes: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile.gradeOrOccupation.trim()) {
      toast.info("請填寫年級或職業。")
      return
    }

    setIsSubmitting(true)
    const nextProfile = {
      ...profile,
      gradeOrOccupation: profile.gradeOrOccupation.trim(),
    }
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, profile: nextProfile }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "背景資料儲存失敗。")
      }
      toast.success("背景資料已儲存。")
      onSubmit(nextProfile)
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "背景資料儲存失敗。"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell">
      <header className="study-header">
        <div>
          <p className="eyebrow">Participant {token}</p>
          <h1>基本背景資料</h1>
        </div>
        <div className="progress-pill">Step 1 / 6</div>
      </header>

      <form className="form-panel" onSubmit={submitProfile}>
        <section className="form-intro" aria-label="背景資料用途">
          <h2>開始前先填背景資料</h2>
          <p>
            這些資料用來分析不同金融背景與模型判斷之間的差異，不會用來篩選資格。金融課程經驗可以幫助後續解讀熟悉度，
            所以建議保留，但只作為背景變項。
          </p>
        </section>

        <fieldset>
          <legend>背景分類</legend>
          <label>
            是否商學院 / 金融相關背景 *
            <select
              value={profile.isBusinessOrFinance}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  isBusinessOrFinance: event.target
                    .value as ParticipantProfile["isBusinessOrFinance"],
                })
              }
            >
              <option value="unsure">不確定 / 跨領域</option>
              <option value="yes">是</option>
              <option value="no">否</option>
            </select>
          </label>
          <label>
            年級或職業 *
            <input
              value={profile.gradeOrOccupation}
              placeholder="例如：大三、研究生、金融業、工程師"
              onBlur={() =>
                setProfile({
                  ...profile,
                  gradeOrOccupation: profile.gradeOrOccupation.trim(),
                })
              }
              onChange={(event) =>
                setProfile({
                  ...profile,
                  gradeOrOccupation: event.target.value,
                })
              }
            />
          </label>
          <label>
            金融課程或自學經驗 *
            <select
              value={profile.hasTakenFinanceCourse}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  hasTakenFinanceCourse: event.target
                    .value as ParticipantProfile["hasTakenFinanceCourse"],
                })
              }
            >
              <option value="no">否</option>
              <option value="in_progress">正在修 / 自學中</option>
              <option value="yes">是</option>
            </select>
            <span className="field-hint">
              這題不是資格判斷，只用來理解你回答時可能依賴的金融背景。
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend>使用經驗</legend>
          <ScaleInput
            label="金融熟悉程度"
            value={profile.financeFamiliarity}
            onChange={(value) =>
              setProfile({ ...profile, financeFamiliarity: value })
            }
          />
          <label>
            LLM / ChatGPT 使用頻率 *
            <select
              value={profile.llmExperience}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  llmExperience: event.target
                    .value as ParticipantProfile["llmExperience"],
                })
              }
            >
              <option value="none">幾乎沒有（近 1 個月 0 次）</option>
              <option value="rare">很少使用（每月 1-3 次）</option>
              <option value="monthly">偶爾使用（每週 1-2 次）</option>
              <option value="weekly">經常使用（每週 3-6 次）</option>
              <option value="daily">幾乎每天使用（每天 1 次以上）</option>
            </select>
            <span className="field-hint">
              請用最近一個月的平均使用頻率作答。
            </span>
          </label>
          <label>
            其他背景備註
            <textarea
              value={profile.notes}
              rows={3}
              placeholder="可留空"
              onChange={(event) =>
                setProfile({ ...profile, notes: event.target.value })
              }
            />
          </label>
        </fieldset>

        <div className="form-actions">
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "儲存中..." : "開始 5 題盲測問卷"}
          </Button>
        </div>
      </form>
    </main>
  )
}
