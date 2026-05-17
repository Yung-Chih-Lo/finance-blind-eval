"use client"

import { useRef, useState } from "react"
import { ArrowUp } from "lucide-react"

import {
  QualityControls,
  type FacetSelectionState,
} from "@/components/evaluation/quality-controls"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import type {
  AnswerLabel,
  ParticipantProfile,
  StudyConfig,
} from "@/lib/evaluation/types"

interface AnswerResponse {
  questionId: string
  answers: Record<AnswerLabel, string>
  latencyMs: number
  error?: string
}

interface RecordResponse {
  completionStatus?: "in_progress" | "completed"
  answeredCount?: number
  error?: string
}

interface QuestionFlowProps {
  config: StudyConfig
  token: string
  profile: ParticipantProfile
  initialQuestionIndex?: number
  initialQuestion?: string
  initialAnswerResponse?: AnswerResponse | null
  onAnswerSaved?: (answeredCount: number) => void
  onComplete: () => void
}

function createEmptyFacetSelections(config: StudyConfig): FacetSelectionState {
  return Object.fromEntries(
    config.evaluationFacets.map((facet) => [facet.id, ""])
  ) as FacetSelectionState
}

export function QuestionFlow({
  config,
  token,
  profile,
  initialQuestionIndex = 0,
  initialQuestion = "",
  initialAnswerResponse = null,
  onAnswerSaved,
  onComplete,
}: QuestionFlowProps) {
  const toast = useToast()
  const questionInputRef = useRef<HTMLTextAreaElement>(null)
  const promptCategories = config.promptCategories
  const answerLabels = config.answerLabels
  const minQuestionLength = config.limits.minQuestionLength
  const maxQuestionLength = config.limits.maxQuestionLength
  const [questionIndex, setQuestionIndex] = useState(
    Math.min(initialQuestionIndex, promptCategories.length - 1)
  )
  const [question, setQuestion] = useState(initialQuestion)
  const [answerResponse, setAnswerResponse] = useState<AnswerResponse | null>(
    initialAnswerResponse
  )
  const [selectedBest, setSelectedBest] = useState<AnswerLabel | "">("")
  const [selectedWorst, setSelectedWorst] = useState<AnswerLabel | "">("")
  const [bestReason, setBestReason] = useState("")
  const [worstReason, setWorstReason] = useState("")
  const [facetSelections, setFacetSelections] = useState<FacetSelectionState>(
    () => createEmptyFacetSelections(config)
  )
  const [worstAnswerFlags, setWorstAnswerFlags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const category = promptCategories[questionIndex]
  const progressLabel = `${questionIndex + 1} / ${promptCategories.length}`

  function applyExample(example: string) {
    if (answerResponse || isLoading) {
      return
    }
    setQuestion(example)
    questionInputRef.current?.focus()
  }

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (question.trim().length < minQuestionLength) {
      toast.info(`請輸入較完整的問題，至少 ${minQuestionLength} 個字。`)
      return
    }
    if (question.trim().length > maxQuestionLength) {
      toast.info(`問題最多 ${maxQuestionLength} 個字，請精簡後再送出。`)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/evaluation/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantToken: token,
          questionIndex: questionIndex + 1,
          promptCategoryId: category.id,
          userQuestion: question,
        }),
      })
      const data = (await response.json()) as AnswerResponse
      if (!response.ok) {
        throw new Error(
          data.error || "目前模型服務無法產生回答，請通知研究人員。"
        )
      }
      setAnswerResponse(data)
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "目前模型服務無法產生回答，請通知研究人員。"
      )
    } finally {
      setIsLoading(false)
    }
  }

  function resetForQuestion() {
    setQuestion("")
    setAnswerResponse(null)
    setSelectedBest("")
    setSelectedWorst("")
    setBestReason("")
    setWorstReason("")
    setFacetSelections(createEmptyFacetSelections(config))
    setWorstAnswerFlags([])
  }

  async function saveJudgment() {
    if (!answerResponse) {
      return
    }
    if (!selectedBest || !selectedWorst) {
      toast.info("請選出最好與最差的回答。")
      return
    }
    if (selectedBest === selectedWorst) {
      toast.info("最好與最差不能選同一個回答。")
      return
    }
    if (Object.values(facetSelections).some((selection) => !selection)) {
      toast.info("請完成四個面向的 A / B / C 比較。")
      return
    }
    if (!bestReason.trim() && !worstReason.trim()) {
      toast.info("請至少填寫一欄簡短原因；若可以，請同時說明最好與最差的判斷。")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/evaluation/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: answerResponse.questionId,
          selectedBest,
          selectedWorst,
          facetSelections,
          bestReason,
          worstReason,
          worstAnswerFlags,
        }),
      })
      const data = (await response.json()) as RecordResponse
      if (!response.ok) {
        throw new Error(data.error || "評分儲存失敗。")
      }
      if (
        data.completionStatus === "completed" ||
        questionIndex === promptCategories.length - 1
      ) {
        onAnswerSaved?.(data.answeredCount ?? questionIndex + 1)
        toast.success("問卷已完成，謝謝你的協助。")
        onComplete()
        return
      }
      onAnswerSaved?.(data.answeredCount ?? questionIndex + 1)
      toast.success("本題評分已儲存。")
      setQuestionIndex((value) => value + 1)
      resetForQuestion()
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "評分儲存失敗。"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="page-shell eval-page">
      <header className="study-header">
        <div>
          <p className="eyebrow">Participant {profile.token}</p>
          <h1>{category.title}</h1>
        </div>
        <div className="progress-pill">題目 {progressLabel}</div>
      </header>

      <div className="stepper" aria-label="問卷進度">
        {promptCategories.map((item, index) => (
          <span
            aria-label={`第 ${index + 1} 題 ${item.title}`}
            className={
              index <= questionIndex ? "step-dot is-active" : "step-dot"
            }
            key={item.id}
          />
        ))}
      </div>

      <section className="question-layout question-chat-layout">
        <form
          className="prompt-panel chat-panel prompt-chat-panel"
          onSubmit={submitQuestion}
        >
          <div className="prompt-guide chat-hero">
            <p className="panel-kicker prompt-kicker">可參考方向</p>
            <h2>隨時準備好就可以開始了。</h2>
            <p className="example-text">{category.instruction}</p>
            <div className="prompt-suggestion-grid" aria-label="可參考問題範例">
              {category.examples.map((example, index) => (
                <button
                  className="prompt-suggestion"
                  disabled={Boolean(answerResponse) || isLoading}
                  key={example}
                  type="button"
                  onClick={() => applyExample(example)}
                >
                  <span>範例 {index + 1}</span>
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="chat-composer">
            <label className="sr-only" htmlFor="user-question">
              你的金融問題
            </label>
            <div className="composer-box">
              <textarea
                id="user-question"
                ref={questionInputRef}
                value={question}
                rows={1}
                placeholder="請輸入金融相關問題；避免個人持股、內部資料、即時股價或直接買賣建議"
                disabled={Boolean(answerResponse) || isLoading}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              {!answerResponse ? (
                <Button
                  aria-label="送出問題"
                  className="composer-submit"
                  disabled={isLoading}
                  type="submit"
                >
                  {isLoading ? "..." : <ArrowUp />}
                </Button>
              ) : null}
            </div>
          </div>
        </form>

        {answerResponse ? (
          <section className="comparison-panel" aria-label="盲測回答比較">
            <div className="comparison-head">
              <div>
                <p className="panel-kicker">Blind Comparison</p>
                <h2>比較 A / B / C 回答</h2>
              </div>
            </div>

            <div className="answer-grid">
              {answerLabels.map((label) => (
                <article className="answer-card" key={label}>
                  <div className="answer-label">回答 {label}</div>
                  <p>{answerResponse.answers[label]}</p>
                </article>
              ))}
            </div>

            <fieldset className="judgment-grid">
              <legend>整體判斷</legend>
              <label>
                整體最好的是哪個回答？*
                <select
                  value={selectedBest}
                  onChange={(event) =>
                    setSelectedBest(event.target.value as AnswerLabel)
                  }
                >
                  <option value="">請選擇</option>
                  {answerLabels.map((label) => (
                    <option key={label} value={label}>
                      回答 {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                整體最差的是哪個回答？*
                <select
                  value={selectedWorst}
                  onChange={(event) =>
                    setSelectedWorst(event.target.value as AnswerLabel)
                  }
                >
                  <option value="">請選擇</option>
                  {answerLabels.map((label) => (
                    <option key={label} value={label}>
                      回答 {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                為什麼你選它最好？（簡短說明）
                <textarea
                  value={bestReason}
                  rows={3}
                  onChange={(event) => setBestReason(event.target.value)}
                />
              </label>
              <label>
                為什麼你選它最差？（簡短說明）
                <textarea
                  value={worstReason}
                  rows={3}
                  onChange={(event) => setWorstReason(event.target.value)}
                />
              </label>
              <p className="judgment-helper">
                至少需填寫一欄原因；若可以，請同時說明最好與最差的判斷依據，方便後續質性分析。
              </p>
            </fieldset>

            <QualityControls
              answerLabels={answerLabels}
              evaluationFacets={config.evaluationFacets}
              facetSelections={facetSelections}
              setFacetSelections={setFacetSelections}
              worstAnswerFlagOptions={config.worstAnswerFlags}
              worstAnswerFlags={worstAnswerFlags}
              setWorstAnswerFlags={setWorstAnswerFlags}
            />

            <div className="form-actions">
              <Button
                className="secondary-button"
                disabled={isLoading}
                type="button"
                onClick={resetForQuestion}
              >
                重新輸入本題
              </Button>
              <Button disabled={isLoading} type="button" onClick={saveJudgment}>
                {questionIndex === promptCategories.length - 1
                  ? "完成問卷"
                  : "儲存並進入下一題"}
              </Button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
