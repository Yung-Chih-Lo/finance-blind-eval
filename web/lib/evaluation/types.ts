export type ModelId = "H1-best" | "H2-best" | "TAIDE-baseline"
export type AnswerLabel = "A" | "B" | "C"
export type CompletionStatus = "profile_started" | "in_progress" | "completed"
export type EvaluationFacetId = "correctness" | "reasoning" | "completeness" | "readability"
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

export type AgeRange = "20_24" | "25_29" | "30_39" | "40_plus" | "prefer_not_to_say"
export type Gender = "female" | "male" | "non_binary_or_other" | "prefer_not_to_say"
export type EducationLevel =
  | "high_school_or_below"
  | "undergrad_in_progress"
  | "undergrad_completed"
  | "grad_or_above"
  | "prefer_not_to_say"
export type FinanceBackgroundType =
  | "student_finance_related"
  | "student_other"
  | "working_finance_related"
  | "working_other"
  | "prefer_not_to_say"
export type FinanceWorkExperience = "none" | "course_project" | "internship" | "professional" | "prefer_not_to_say"
export type InvestmentExperience = "none" | "basic" | "regular" | "advanced" | "prefer_not_to_say"
export type FinanceSubdomain =
  | "accounting"
  | "stocks"
  | "funds_etf"
  | "bonds_rates"
  | "macro_fx"
  | "personal_finance"
  | "not_sure"

export interface ParticipantProfile {
  token: string
  knownName?: string
  ageRange: AgeRange
  gender: Gender
  educationLevel: EducationLevel
  financeBackgroundType: FinanceBackgroundType
  gradeOrOccupation?: string
  financeWorkExperience: FinanceWorkExperience
  investmentExperience: InvestmentExperience
  financeFamiliarity: number
  llmExperience: "none" | "rare" | "monthly" | "weekly" | "daily"
  hasUsedAiForFinance: boolean
  financeSubdomains: FinanceSubdomain[]
  notes: string
}

// Form-state representation of a participant profile in progress.
// Every required field starts as null until the participant explicitly picks; validation
// rejects null so no field can silently default. The Y/N field uses tri-state (D3); the
// five enum fields use null-sentinel (extends D3 to the primary stratifier and siblings,
// caught by verify-perspective review).
export type ParticipantProfileDraft = Omit<
  ParticipantProfile,
  "hasUsedAiForFinance" | "gender" | "educationLevel" | "financeBackgroundType" | "financeWorkExperience" | "investmentExperience"
> & {
  hasUsedAiForFinance: boolean | null
  gender: Gender | null
  educationLevel: EducationLevel | null
  financeBackgroundType: FinanceBackgroundType | null
  financeWorkExperience: FinanceWorkExperience | null
  investmentExperience: InvestmentExperience | null
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
  reasoning: number
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
  // Four mutually-exclusive buckets derived from financeBackgroundType (see spec
  // scenario "KPI bar reports finance-background breakdown"). Legacy records that
  // lack financeBackgroundType count under unknownBackgroundCount.
  financeBackgroundCount: number
  nonFinanceBackgroundCount: number
  refusalBackgroundCount: number
  unknownBackgroundCount: number
  funnelStages: AdminFunnelStages
  attentionItems: AdminAttentionItems
}

export interface AnswerGenerationResult {
  answers: Record<AnswerLabel, string>
  hiddenModelMapping: Record<AnswerLabel, ModelId>
  gatewayModelMapping: Record<AnswerLabel, string>
  latencyMs: number
}
