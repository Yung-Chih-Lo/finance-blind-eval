"use client"

import { useState } from "react"

import { ScaleInput } from "@/components/evaluation/scale-input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import {
  AGE_RANGE_OPTIONS,
  FINANCE_LLM_USAGE_OPTIONS,
  FINANCE_SUBDOMAIN_OPTIONS,
  FINANCE_WORK_EXPERIENCE_OPTIONS,
  INVESTMENT_EXPERIENCE_OPTIONS,
  createParticipantProfileDraft,
  validateParticipantProfile,
} from "@/lib/evaluation/profile"
import type { FinanceSubdomain, ParticipantProfile } from "@/lib/evaluation/types"

interface ProfileFormProps {
  token: string
  initialProfile?: Partial<ParticipantProfile> | null
  onSubmit: (profile: ParticipantProfile) => void
}

export function ProfileForm({ token, initialProfile, onSubmit }: ProfileFormProps) {
  const toast = useToast()
  const [profile, setProfile] = useState<ParticipantProfile>(() =>
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

    const nextProfile: ParticipantProfile = {
      ...profile,
      gradeOrOccupation: profile.gradeOrOccupation.trim(),
      fieldOrWorkDomain: profile.fieldOrWorkDomain.trim(),
      notes: profile.notes.trim(),
    }
    const issues = validateParticipantProfile(nextProfile)
    if (issues.length > 0) {
      toast.info(issues[0])
      return
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
          <h1>背景資料與研究分層</h1>
        </div>
        <div className="progress-pill">Step 1 / 6</div>
      </header>

      <form className="form-panel" onSubmit={submitProfile}>
        <section className="form-intro" aria-label="背景資料用途">
          <h2>正式作答前，先補齊非識別性背景資料</h2>
          <p>
            這些欄位會用來分析不同金融背景、投資經驗與 AI 使用經驗下的模型偏好差異。
            本研究不收集姓名、公司、帳號或精確年齡；若不方便回答，可選擇不願透露或不確定。
          </p>
        </section>

        <fieldset>
          <legend>基本分層</legend>
          <label>
            年齡區間 *
            <select
              value={profile.ageRange}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  ageRange: event.target.value as ParticipantProfile["ageRange"],
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
            主修、科系或工作領域 *
            <input
              value={profile.fieldOrWorkDomain}
              placeholder="例如：財務金融、會計、資訊管理、軟體工程、行銷"
              onBlur={() =>
                setProfile({
                  ...profile,
                  fieldOrWorkDomain: profile.fieldOrWorkDomain.trim(),
                })
              }
              onChange={(event) =>
                setProfile({
                  ...profile,
                  fieldOrWorkDomain: event.target.value,
                })
              }
            />
            <span className="field-hint">
              請填大方向即可，不需要填學校、公司或可識別身分的資訊。
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend>金融背景</legend>
          <label>
            是否商學院 / 金融相關背景 *
            <select
              value={profile.isBusinessOrFinance}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  isBusinessOrFinance: event.target.value as ParticipantProfile["isBusinessOrFinance"],
                })
              }
            >
              <option value="unsure">不確定 / 跨領域</option>
              <option value="yes">是</option>
              <option value="no">否</option>
            </select>
          </label>
          <label>
            金融課程或自學經驗 *
            <select
              value={profile.hasTakenFinanceCourse}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  hasTakenFinanceCourse: event.target.value as ParticipantProfile["hasTakenFinanceCourse"],
                })
              }
            >
              <option value="no">否</option>
              <option value="in_progress">正在修 / 自學中</option>
              <option value="yes">是</option>
            </select>
          </label>
          <label>
            金融工作、實習或專題經驗 *
            <select
              value={profile.financeWorkExperience}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  financeWorkExperience: event.target.value as ParticipantProfile["financeWorkExperience"],
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
                  investmentExperience: event.target.value as ParticipantProfile["investmentExperience"],
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
                  llmExperience: event.target.value as ParticipantProfile["llmExperience"],
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
            使用 AI 處理金融任務的頻率 *
            <select
              value={profile.financeLlmUsage}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  financeLlmUsage: event.target.value as ParticipantProfile["financeLlmUsage"],
                })
              }
            >
              {FINANCE_LLM_USAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="field-hint">
              金融任務包含理解財報、投資風險、總經事件、金融名詞或理財問題。
            </span>
          </label>
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
