export type ModelId = "H1-best" | "H2-best" | "TAIDE-baseline"
export type AnswerLabel = "A" | "B" | "C"
export type CompletionStatus = "profile_started" | "in_progress" | "completed"
export type EvaluationFacetId = "correctness" | "completeness" | "readability"
export type PlatformSettingsSource = "default" | "runtime"

export interface ProviderSettings {
  apiBaseUrl: string
  modelsEndpointOverride: string
  apiKeyEnvVar: string
  modelMapping: Record<ModelId, string>
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxTokens: number
}

export interface ProviderSettingsStatus {
  apiKeyEnvVar: string
  apiKeyConfigured: boolean
  hasCompleteModelMapping: boolean
  mappedModelCount: number
}

export interface ProviderModelDiscoveryResult {
  endpoint: string
  modelIds: string[]
  latencyMs: number
  apiKeyConfigured: boolean
}

export interface ProviderPreviewCandidate {
  label: AnswerLabel
  internalModelId: ModelId
  gatewayModelName: string
  text: string
  latencyMs: number
}

export interface ProviderPreviewResult {
  question: string
  candidates: ProviderPreviewCandidate[]
  latencyMs: number
}

export interface StudyConfig {
  study: {
    eyebrow: string
    title: string
    rootTitle: string
    rootDescription: string
    intro: {
      greeting: string
      paragraphs: string[]
      tasks: string[]
    }
    signature: {
      closing: string
      studentName: string
      affiliation: string
      advisor: string
      thesisTitle: string
    }
    completion: {
      eyebrow: string
      title: string
      description: string
      notes: string[]
    }
  }
  limits: {
    minQuestionLength: number
    maxQuestionLength: number
    maxQuestionsPerParticipant: number
    rateLimit: {
      inviteRedeemPerIpPerHour: number
      answerRequestsPerIpPerMinute: number
      answerRequestsPerSessionPerMinute: number
    }
  }
  answerLabels: AnswerLabel[]
  modelIds: ModelId[]
  promptCategories: PromptCategory[]
  evaluationFacets: Array<{ id: EvaluationFacetId; label: string; helper: string }>
  worstAnswerFlags: Array<{ id: string; label: string }>
}

export interface PlatformSettingsEnvelope {
  settingsVersion: number
  updatedAt: string
  updatedBy: string
  settingsSnapshotHash?: string
  config: StudyConfig
  provider: ProviderSettings
}

export interface PlatformSettingsSnapshot {
  source: PlatformSettingsSource
  settingsVersion: number
  settingsSnapshotHash: string
  updatedAt: string
  updatedBy: string
}

export interface ActivePlatformSettings extends PlatformSettingsSnapshot {
  path: string
  envelope: PlatformSettingsEnvelope
  config: StudyConfig
  provider: ProviderSettings
  providerStatus: ProviderSettingsStatus
}

export interface PlatformSettingsValidationResult {
  ok: boolean
  issues: string[]
}

// Schema v2 (2026-05-24): replaced the 13-field profile from refine-survey-copy-and-facets
// with the 5-field stratification axes the advisor approved on 2026-05-20. The legacy
// compatibility layer (migrateLegacyProfile, extractLegacyProfileSnapshot, isLegacyShape,
// upsertParticipantStatusAndClearPending, legacy_* CSV columns, legacyProfile JSON block)
// was deleted in the same change. Do NOT re-introduce a migration shim — if the schema
// changes again, wipe the store on deploy. See archived openspec change:
// `openspec/changes/archive/<date>-simplify-participant-profile-to-5-fields/design.md`
// (decisions D1 and D5).
//
// Field rename history (2026-05-24 simplify-participant-profile-to-5-fields):
//   financeBackgroundType (5-value) → MainDomain (3-value)
//   llmExperience          (5-value) → AiUsageFrequency (4-value)
// `ageRange` and `educationLevel` kept their names but lost their `prefer_not_to_say` arm.
// `gender`, `gradeOrOccupation`, `financeWorkExperience`, `investmentExperience`,
// `financeFamiliarity`, `financeSubdomains`, `notes`, `knownName` were dropped entirely.
export type AgeRange = "20_24" | "25_29" | "30_39" | "40_plus"
export type EducationLevel = "undergrad_in_progress" | "undergrad_completed" | "grad_or_above"
export type MainDomain = "finance_related" | "business_non_finance"
export type AiUsageFrequency = "never" | "occasional" | "frequent" | "daily"

export interface ParticipantProfile {
  token: string
  ageRange: AgeRange
  educationLevel: EducationLevel
  mainDomain: MainDomain
  aiUsageFrequency: AiUsageFrequency
  hasUsedAiForFinance: boolean
}

// Form-state representation of a participant profile in progress.
// All 5 stratification fields start as null until the participant explicitly picks;
// validation rejects null so the participant cannot accidentally submit a default.
// The Y/N field uses tri-state (same pattern as the four enum fields) to prevent
// false from being silently chosen on behalf of the participant.
export type ParticipantProfileDraft = {
  token: string
  ageRange: AgeRange | null
  educationLevel: EducationLevel | null
  mainDomain: MainDomain | null
  aiUsageFrequency: AiUsageFrequency | null
  hasUsedAiForFinance: boolean | null
}

export interface ParticipantStatus {
  token: string
  profile?: ParticipantProfile
  completionStatus: CompletionStatus
  startedAt: string
  updatedAt: string
  completedAt?: string
}

export interface EvaluationSession {
  id: string
  sessionHash: string
  participantToken: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
}

export interface PromptCategory {
  id: string
  title: string
  instruction: string
  examples: string[]
}

export interface ModelAnswer {
  label: AnswerLabel
  text: string
}

export interface QualityRatings {
  correctness: number
  completeness: number
  professionalism: number
  readability: number
}

export type FacetSelections = Record<EvaluationFacetId, AnswerLabel>

export interface ModelComparisonCounts {
  overallBest: number
  overallWorst: number
  net: number
  correctness: number
  completeness: number
  readability: number
}

export interface PendingQuestion {
  id: string
  participantToken: string
  participantProfile: ParticipantProfile
  questionIndex: number
  promptCategory: string
  promptCategoryId: string
  userQuestion: string
  answers: Record<AnswerLabel, string>
  hiddenModelMapping: Record<AnswerLabel, ModelId>
  gatewayModelMapping: Record<AnswerLabel, string>
  settingsVersion?: number
  settingsSnapshotHash?: string
  timestamp: string
  responseLatencyMs: number
}

export interface EvaluationRecord extends PendingQuestion {
  selectedBest: AnswerLabel
  selectedWorst: AnswerLabel
  facetSelections?: Partial<FacetSelections>
  bestReason: string
  worstReason: string
  worstAnswerFlags?: string[]
  // Free-text supplement when the participant selects the "其他" worst-flag option.
  // Required at the UI layer (gated by question-flow's saveJudgment) but persisted
  // as optional so historical records pre-dating the "其他" option remain valid.
  worstOtherText?: string
  qualityFlags?: string[]
  qualityRatings?: QualityRatings
  completionStatus: "answered"
}

export interface EvaluationStore {
  participants: ParticipantStatus[]
  sessions: EvaluationSession[]
  pendingQuestions: PendingQuestion[]
  records: EvaluationRecord[]
}

export interface AdminFunnelStages {
  redeemed: number
  profileCompleted: number
  answeredAny: number
  completed: number
}

export interface AdminAttentionTopWorstFlag {
  flagId: string
  flagLabel: string
  modelId: ModelId
  count: number
}

export interface AdminAttentionLatencyOutlier {
  recordId: string
  latencyMs: number
  participantToken: string
  questionIndex: number
}

export interface AdminAttentionStalledParticipant {
  token: string
  lastActivityAt: string
  answeredCount: number
}

export interface AdminAttentionItems {
  topWorstFlags: AdminAttentionTopWorstFlag[]
  latencyOutliers: AdminAttentionLatencyOutlier[]
  stalledParticipants: AdminAttentionStalledParticipant[]
}

export interface AdminSnapshot {
  participants: ParticipantStatus[]
  records: EvaluationRecord[]
  modelCounts: Record<ModelId, { best: number; worst: number }>
  comparativeCounts: Record<ModelId, ModelComparisonCounts>
  worstFlagCounts: Record<ModelId, Record<string, number>>
  completedCount: number
  // Two mutually-exclusive buckets derived from mainDomain (see spec scenario
  // "KPI bar reports main-domain breakdown"). No unknown bucket: validation rejects
  // null mainDomain at submit time, and the legacy compatibility layer that could
  // produce profile-without-mainDomain rows has been removed. The legacy "other"
  // bucket was removed when the TA was narrowed to business-school students.
  financeRelatedCount: number
  businessNonFinanceCount: number
  funnelStages: AdminFunnelStages
  attentionItems: AdminAttentionItems
}

export interface AnswerGenerationResult {
  answers: Record<AnswerLabel, string>
  hiddenModelMapping: Record<AnswerLabel, ModelId>
  gatewayModelMapping: Record<AnswerLabel, string>
  latencyMs: number
}
