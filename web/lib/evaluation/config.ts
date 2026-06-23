import rawConfig from "@/config/evaluation.config.json"

import type { AnswerLabel, EvaluationFacetId, ModelId, PromptCategory, StudyConfig } from "./types"

export const DEFAULT_STUDY_CONFIG = rawConfig as StudyConfig

export const STUDY_CONFIG = DEFAULT_STUDY_CONFIG

export const ANSWER_LABELS = STUDY_CONFIG.answerLabels as AnswerLabel[]

export const MODEL_IDS = STUDY_CONFIG.modelIds as ModelId[]

export const PROMPT_CATEGORIES = STUDY_CONFIG.promptCategories as PromptCategory[]

export const SEEDED_PARTICIPANTS: Record<string, { name: string; group: string }> = {}

export const EVALUATION_FACETS = STUDY_CONFIG.evaluationFacets as Array<{
  id: EvaluationFacetId
  label: string
  helper: string
}>

export const WORST_ANSWER_FLAGS = STUDY_CONFIG.worstAnswerFlags

export const QUALITY_FLAGS = WORST_ANSWER_FLAGS

export const MIN_QUESTION_LENGTH = STUDY_CONFIG.limits.minQuestionLength

export const MAX_QUESTION_LENGTH = STUDY_CONFIG.limits.maxQuestionLength

export const MAX_QUESTIONS_PER_PARTICIPANT = STUDY_CONFIG.limits.maxQuestionsPerParticipant

export const RATE_LIMITS = STUDY_CONFIG.limits.rateLimit
