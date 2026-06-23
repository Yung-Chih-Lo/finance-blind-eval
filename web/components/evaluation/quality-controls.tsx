"use client"

import { ScaleInput } from "@/components/evaluation/scale-input"
import type { AnswerScoreDraft } from "@/lib/evaluation/answer-scores"
import type { AnswerLabel, EvaluationFacetId, StudyConfig } from "@/lib/evaluation/types"

interface QualityControlsProps {
  answerLabels: StudyConfig["answerLabels"]
  evaluationFacets: StudyConfig["evaluationFacets"]
  answerScores: AnswerScoreDraft
  setAnswerScores: (scores: AnswerScoreDraft) => void
  worstAnswerFlagOptions: StudyConfig["worstAnswerFlags"]
  worstAnswerFlags: string[]
  setWorstAnswerFlags: (flags: string[]) => void
  worstOtherText: string
  setWorstOtherText: (value: string) => void
}

const OTHER_FLAG_ID = "other"

export function QualityControls({
  answerLabels,
  evaluationFacets,
  answerScores,
  setAnswerScores,
  worstAnswerFlagOptions,
  worstAnswerFlags,
  setWorstAnswerFlags,
  worstOtherText,
  setWorstOtherText,
}: QualityControlsProps) {
  const isOtherSelected = worstAnswerFlags.includes(OTHER_FLAG_ID)
  function updateScore(label: AnswerLabel, facetId: EvaluationFacetId, score: number) {
    setAnswerScores({
      ...answerScores,
      [label]: {
        ...answerScores[label],
        [facetId]: score,
      },
    })
  }

  return (
    <section className="quality-panel">
      <div className="section-heading compact-heading">
        <div>
          <p className="panel-kicker">Facet Scores</p>
          <h3>面向評分</h3>
        </div>
      </div>

      <div className="score-matrix" aria-label="回答面向評分">
        {answerLabels.map((label) => (
          <article className="score-card" key={label}>
            <div className="score-card-head">
              <span>回答 {label}</span>
              <p>請依 1 到 5 分評估每個面向。</p>
            </div>
            <div className="score-card-body">
              {evaluationFacets.map((facet) => (
                <div className="score-facet" key={facet.id}>
                  <ScaleInput
                    label={facet.label}
                    value={answerScores[label]?.[facet.id] ?? 0}
                    onChange={(score) => updateScore(label, facet.id, score)}
                  />
                  <p>{facet.helper}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="worst-flags-panel">
        <h3>整體最差回答的問題標記</h3>
        <div className="flag-grid">
          {worstAnswerFlagOptions.map((flag) => (
            <label className="check-option" key={flag.id}>
              <input
                checked={worstAnswerFlags.includes(flag.id)}
                type="checkbox"
                onChange={(event) => {
                  const nextChecked = event.target.checked
                  setWorstAnswerFlags(
                    nextChecked
                      ? [...worstAnswerFlags, flag.id]
                      : worstAnswerFlags.filter((item) => item !== flag.id),
                  )
                  // Clearing the free-text supplement when "其他" is unchecked
                  // keeps the persisted record consistent — otherwise an unrelated
                  // checkbox flip could leave orphaned worstOtherText behind.
                  if (flag.id === OTHER_FLAG_ID && !nextChecked) {
                    setWorstOtherText("")
                  }
                }}
              />
              {flag.label}
            </label>
          ))}
        </div>
        {isOtherSelected ? (
          <label className="worst-other-input">
            <span>請說明其他標記原因 *</span>
            <textarea
              value={worstOtherText}
              rows={3}
              placeholder="請簡述為什麼勾選「其他」"
              onChange={(event) => setWorstOtherText(event.target.value)}
            />
          </label>
        ) : null}
      </div>
    </section>
  )
}
