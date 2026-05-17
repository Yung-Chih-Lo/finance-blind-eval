"use client"

import { useState } from "react"

import { ScaleInput } from "@/components/evaluation/scale-input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import {
  AGE_RANGE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  FINANCE_BACKGROUND_TYPE_OPTIONS,
  FINANCE_SUBDOMAIN_OPTIONS,
  FINANCE_WORK_EXPERIENCE_OPTIONS,
  GENDER_OPTIONS,
  INVESTMENT_EXPERIENCE_OPTIONS,
  createParticipantProfileDraft,
  validateParticipantProfile,
} from "@/lib/evaluation/profile"
import type {
  FinanceSubdomain,
  ParticipantProfile,
  ParticipantProfileDraft,
} from "@/lib/evaluation/types"

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

  function toggleSubdomain(value: FinanceSubdomain) {
    const current = new Set(profile.financeSubdomains)
    if (value === "not_sure") {
      setProfile({ ...profile, financeSubdomains: current.has("not_sure") ? [] : ["not_sure"] })
      return
    }
    current.delete("not_sure")
    if (current.has(value)) {
      current.delete(value)
    } else {
      current.add(value)
    }
    setProfile({ ...profile, financeSubdomains: Array.from(current) })
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const draft: ParticipantProfileDraft = {
      ...profile,
      gradeOrOccupation: profile.gradeOrOccupation?.trim() || undefined,
      notes: profile.notes.trim(),
    }
    const issues = validateParticipantProfile(draft)
    if (issues.length > 0) {
      toast.info(issues[0])
      return
    }

    // After successful validation hasUsedAiForFinance is guaranteed boolean.
    const nextProfile: ParticipantProfile = {
      ...draft,
      hasUsedAiForFinance: draft.hasUsedAiForFinance === true,
    }

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
          <h1>背景資料與研究分層</h1>
        </div>
        <div className="progress-pill">Step 1 / 6</div>
      </header>

      <form className="form-panel" onSubmit={submitProfile}>
        <section className="form-intro" aria-label="背景資料用途">
          <h2>正式作答前，先補齊非識別性背景資料</h2>
          <p>
            背景資料主要用於樣本描述與金融相關性檢核；主要分層變項預先指定為金融工作或實習經驗，金融熟悉度作為次要連續變項；
            其他人口統計與使用經驗欄位僅作探索性分析，不作為主要推論依據。
            本研究不收集姓名、公司、帳號或精確年齡；若不方便回答，可選擇不願透露或不確定。
          </p>
        </section>

        <fieldset>
          <legend>基本分層</legend>
          <label>
            性別 *
            <select
              value={profile.gender}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  gender: event.target.value as ParticipantProfileDraft["gender"],
                })
              }
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="field-hint">僅供樣本描述，不會作為個別偏好推論依據。</span>
          </label>
          <label>
            年齡區間 *
            <select
              value={profile.ageRange}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  ageRange: event.target.value as ParticipantProfileDraft["ageRange"],
                })
              }
            >
              {AGE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            最高學歷 *
            <select
              value={profile.educationLevel}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  educationLevel: event.target.value as ParticipantProfileDraft["educationLevel"],
                })
              }
            >
              {EDUCATION_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            年級或職稱（選填）
            <input
              value={profile.gradeOrOccupation ?? ""}
              placeholder="例如：大三、碩二、銀行業務、會計師事務所助理"
              onBlur={() =>
                setProfile({
                  ...profile,
                  gradeOrOccupation: profile.gradeOrOccupation?.trim() ?? "",
                })
              }
              onChange={(event) =>
                setProfile({
                  ...profile,
                  gradeOrOccupation: event.target.value,
                })
              }
            />
            <span className="field-hint">可留空。請避免填寫學校、公司名稱或可識別身分的資訊。</span>
          </label>
          <label>
            金融背景類型 *
            <select
              value={profile.financeBackgroundType}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  financeBackgroundType: event.target.value as ParticipantProfileDraft["financeBackgroundType"],
                })
              }
            >
              {FINANCE_BACKGROUND_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>金融背景與經驗</legend>
          <label>
            金融工作、實習或專題經驗 *
            <select
              value={profile.financeWorkExperience}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  financeWorkExperience: event.target.value as ParticipantProfileDraft["financeWorkExperience"],
                })
              }
            >
              {FINANCE_WORK_EXPERIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            投資 / 理財經驗 *
            <select
              value={profile.investmentExperience}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  investmentExperience: event.target.value as ParticipantProfileDraft["investmentExperience"],
                })
              }
            >
              {INVESTMENT_EXPERIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <ScaleInput
            label="金融熟悉程度"
            value={profile.financeFamiliarity}
            onChange={(value) =>
              setProfile({ ...profile, financeFamiliarity: value })
            }
          />
          <div className="field-group">
            <span className="field-label">熟悉的金融子領域 *</span>
            <div className="checkbox-grid">
              {FINANCE_SUBDOMAIN_OPTIONS.map((option) => (
                <label className="check-option" key={option.value}>
                  <input
                    checked={profile.financeSubdomains.includes(option.value)}
                    type="checkbox"
                    onChange={() => toggleSubdomain(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>AI 使用經驗</legend>
          <label>
            LLM / ChatGPT 一般使用頻率 *
            <select
              value={profile.llmExperience}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  llmExperience: event.target.value as ParticipantProfileDraft["llmExperience"],
                })
              }
            >
              <option value="none">幾乎沒有（近 1 個月 0 次）</option>
              <option value="rare">很少使用（每月 1-3 次）</option>
              <option value="monthly">偶爾使用（每週 1-2 次）</option>
              <option value="weekly">經常使用（每週 3-6 次）</option>
              <option value="daily">幾乎每天使用（每天 1 次以上）</option>
            </select>
            <span className="field-hint">請用最近一個月的平均使用頻率作答。</span>
          </label>
          <div className="field-group">
            <span className="field-label">是否曾用 AI / ChatGPT 處理金融、投資、財報、課業或工作相關問題？ *</span>
            <div className="radio-row">
              <label className="check-option">
                <input
                  checked={profile.hasUsedAiForFinance === true}
                  name="hasUsedAiForFinance"
                  type="radio"
                  onChange={() => setProfile({ ...profile, hasUsedAiForFinance: true })}
                />
                是
              </label>
              <label className="check-option">
                <input
                  checked={profile.hasUsedAiForFinance === false}
                  name="hasUsedAiForFinance"
                  type="radio"
                  onChange={() => setProfile({ ...profile, hasUsedAiForFinance: false })}
                />
                否
              </label>
            </div>
            <span className="field-hint">兩個選項預設皆未選，請依實際情況勾選一項。</span>
          </div>
          <label>
            其他背景備註
            <textarea
              value={profile.notes}
              rows={3}
              placeholder="可留空；請不要填姓名、帳號、公司內部資料或其他可識別資訊"
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
