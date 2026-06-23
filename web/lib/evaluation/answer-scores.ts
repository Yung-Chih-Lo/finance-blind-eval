import type {
  AnswerLabel,
  AnswerScores,
  EvaluationFacetId,
  StudyConfig,
} from "@/lib/evaluation/types"

export type AnswerScoreDraft = Record<
  AnswerLabel,
  Record<EvaluationFacetId, number | null>
>

export const SCORE_VALUES = [1, 2, 3, 4, 5] as const

export function isAnswerScoreValue(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

export function createEmptyAnswerScoreDraft(
  config: Pick<StudyConfig, "answerLabels" | "evaluationFacets">,
): AnswerScoreDraft {
  return Object.fromEntries(
    config.answerLabels.map((label) => [
      label,
      Object.fromEntries(config.evaluationFacets.map((facet) => [facet.id, null])),
    ]),
  ) as AnswerScoreDraft
}

export function normalizeAnswerScores(
  value: unknown,
  config: Pick<StudyConfig, "answerLabels" | "evaluationFacets">,
): AnswerScores | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const scores = value as Record<string, Record<string, unknown>>
  const normalized = {} as AnswerScores

  for (const label of config.answerLabels) {
    const byFacet = scores[label]
    if (!byFacet || typeof byFacet !== "object") {
      return undefined
    }
    normalized[label] = {} as AnswerScores[AnswerLabel]
    for (const facet of config.evaluationFacets) {
      const score = byFacet[facet.id]
      if (!isAnswerScoreValue(score)) {
        return undefined
      }
      normalized[label][facet.id] = score
    }
  }

  return normalized
}

export function isCompleteAnswerScoreDraft(
  value: AnswerScoreDraft,
  config: Pick<StudyConfig, "answerLabels" | "evaluationFacets">,
): boolean {
  return normalizeAnswerScores(value, config) != null
}
