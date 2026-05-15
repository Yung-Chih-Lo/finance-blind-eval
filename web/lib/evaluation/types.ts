export type ModelId = "H1-best" | "H2-best" | "TAIDE-baseline"
export type AnswerLabel = "A" | "B" | "C"
export type CompletionStatus = "profile_started" | "in_progress" | "completed"
export type EvaluationFacetId = "correctness" | "reasoning" | "completeness" | "readability"
export type PlatformSettingsSource = "default" | "runtime"

export interface ProviderSettings {
  chatCompletionsEndpoint: string
  modelsEndpoint: string
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
  modelsEndpoint: string
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

export interface ParticipantProfile {
  token: string
  knownName?: string
  isBusinessOrFinance: "yes" | "no" | "unsure"
  gradeOrOccupation: string
  hasTakenFinanceCourse: "yes" | "no" | "in_progress"
  financeFamiliarity: number
  llmExperience: "none" | "rare" | "monthly" | "weekly" | "daily"
  notes: string
}

export interface ParticipantStatus {
  token: string
  inviteId?: string
  profile?: ParticipantProfile
  completionStatus: CompletionStatus
  startedAt: string
  updatedAt: string
  completedAt?: string
}

export interface InviteCodeRecord {
  id: string
  codeHash: string
  label?: string
  maxUses: number
  uses: number
  createdAt: string
  expiresAt?: string
  lastRedeemedAt?: string
  participantTokens: string[]
}

export interface EvaluationSession {
  id: string
  sessionHash: string
  participantToken: string
  inviteId: string
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
  invites: InviteCodeRecord[]
  sessions: EvaluationSession[]
  pendingQuestions: PendingQuestion[]
  records: EvaluationRecord[]
}

export interface AdminFunnelStages {
  invited: number
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
  invites: InviteCodeRecord[]
  completedCount: number
  financeBackgroundCount: number
  nonFinanceBackgroundCount: number
  funnelStages: AdminFunnelStages
  attentionItems: AdminAttentionItems
}

export interface AnswerGenerationResult {
  answers: Record<AnswerLabel, string>
  hiddenModelMapping: Record<AnswerLabel, ModelId>
  gatewayModelMapping: Record<AnswerLabel, string>
  latencyMs: number
}
