"use client"

import type { AnswerLabel, EvaluationFacetId, StudyConfig } from "@/lib/evaluation/types"

export type FacetSelectionState = Record<EvaluationFacetId, AnswerLabel | "">

interface QualityControlsProps {
  answerLabels: StudyConfig["answerLabels"]
  evaluationFacets: StudyConfig["evaluationFacets"]
  facetSelections: FacetSelectionState
  setFacetSelections: (selections: FacetSelectionState) => void
  worstAnswerFlagOptions: StudyConfig["worstAnswerFlags"]
  worstAnswerFlags: string[]
  setWorstAnswerFlags: (flags: string[]) => void
}

export function QualityControls({
  answerLabels,
  evaluationFacets,
  facetSelections,
  setFacetSelections,
  worstAnswerFlagOptions,
  worstAnswerFlags,
  setWorstAnswerFlags,
}: QualityControlsProps) {
  return (
    <section className="quality-panel">
      <div className="section-heading compact-heading">
        <div>
          <p className="panel-kicker">Facet Comparison</p>
          <h3>面向式比較</h3>
        </div>
      </div>

      <div className="facet-grid" aria-label="面向式比較">
        {evaluationFacets.map((facet) => (
          <div className="facet-row" key={facet.id}>
            <div>
              <span>{facet.label}</span>
              <p>{facet.helper}</p>
            </div>
            <div className="answer-choice-row" role="radiogroup" aria-label={facet.label}>
              {answerLabels.map((label) => (
                <button
                  aria-checked={facetSelections[facet.id] === label}
                  className={facetSelections[facet.id] === label ? "answer-choice is-active" : "answer-choice"}
                  key={label}
                  role="radio"
                  type="button"
                  onClick={() => setFacetSelections({ ...facetSelections, [facet.id]: label })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
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
                  setWorstAnswerFlags(
                    event.target.checked
                      ? [...worstAnswerFlags, flag.id]
                      : worstAnswerFlags.filter((item) => item !== flag.id),
                  )
                }}
              />
              {flag.label}
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}
