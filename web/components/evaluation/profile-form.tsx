"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import {
  AGE_RANGE_OPTIONS,
  AI_USAGE_FREQUENCY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  MAIN_DOMAIN_OPTIONS,
  createParticipantProfileDraft,
  isCompleteParticipantProfile,
  validateParticipantProfile,
} from "@/lib/evaluation/profile"
import type { ParticipantProfile, ParticipantProfileDraft } from "@/lib/evaluation/types"

interface ProfileFormProps {
  token: string
  initialProfile?: Partial<ParticipantProfile> | null
  onSubmit: (profile: ParticipantProfile) => void
}

export function ProfileForm({ token, initialProfile, onSubmit }: ProfileFormProps) {
  const toast = useToast()
  const [profile, setProfile] = useState<ParticipantProfileDraft>(() =>
    createParticipantProfileDraft(token, initialProfile),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // isCompleteParticipantProfile narrows the draft to ParticipantProfile only when
    // every required field is non-null — so silent defaults are caught before submit.
    // Surface ALL missing-field issues in one toast so the participant fixes them in
    // a single pass instead of N round-trips.
    if (!isCompleteParticipantProfile(profile)) {
      const issues = validateParticipantProfile(profile)
      toast.info(issues.length > 1 ? `請完成以下欄位：${issues.join(" / ")}` : issues[0])
      return
    }
    const nextProfile: ParticipantProfile = profile

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, profile: nextProfile }),
      })
      const data = (await response.json()) as { error?: string; issues?: string[] }
      if (!response.ok) {
        throw new Error(data.issues?.[0] || data.error || "背景資料儲存失敗。")
      }
      toast.success("背景資料已儲存。")
      onSubmit(nextProfile)
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "背景資料儲存失敗。",
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
          <h1>背景資料</h1>
        </div>
      </header>

      <form className="form-panel" onSubmit={submitProfile}>
        <fieldset>
          <legend>研究分層（共 5 題，皆必填）</legend>

          <label>
            年齡 *
            <select
              value={profile.ageRange ?? ""}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  ageRange: (event.target.value || null) as ParticipantProfileDraft["ageRange"],
                })
              }
            >
              <option value="" disabled>
                請選擇
              </option>
              {AGE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            學歷 *
            <select
              value={profile.educationLevel ?? ""}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  educationLevel: (event.target.value || null) as ParticipantProfileDraft["educationLevel"],
                })
              }
            >
              <option value="" disabled>
                請選擇
              </option>
              {EDUCATION_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            目前主要領域 *
            <select
              value={profile.mainDomain ?? ""}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  mainDomain: (event.target.value || null) as ParticipantProfileDraft["mainDomain"],
                })
              }
            >
              <option value="" disabled>
                請選擇
              </option>
              {MAIN_DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="field-hint">請選擇最能代表您目前所在科系或工作領域的選項。</span>
          </label>

          <label>
            AI 使用頻率 *
            <select
              value={profile.aiUsageFrequency ?? ""}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  aiUsageFrequency: (event.target.value || null) as ParticipantProfileDraft["aiUsageFrequency"],
                })
              }
            >
              <option value="" disabled>
                請選擇
              </option>
              {AI_USAGE_FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="field-hint">請以最近一個月的平均使用情況作答。</span>
          </label>

          <label>
            是否曾用 AI 工具處理金融問題？ *
            <select
              value={profile.hasUsedAiForFinance === null ? "" : String(profile.hasUsedAiForFinance)}
              onChange={(event) => {
                const value = event.target.value
                setProfile({
                  ...profile,
                  hasUsedAiForFinance: value === "" ? null : value === "true",
                })
              }}
            >
              <option value="" disabled>
                請選擇
              </option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
            <span className="field-hint">
              曾用 ChatGPT、Claude、Gemini 等 AI 工具，查詢、討論或解答金融、投資、財務、會計、總經相關問題。
            </span>
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
