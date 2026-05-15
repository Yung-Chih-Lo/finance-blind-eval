export type ModelId = "H1-best" | "H2-best" | "TAIDE-baseline";
export type AnswerLabel = "A" | "B" | "C";
export type CompletionStatus = "profile_started" | "in_progress" | "completed";

export interface ParticipantProfile {
  token: string;
  knownName?: string;
  isBusinessOrFinance: "yes" | "no" | "unsure";
  gradeOrOccupation: string;
  hasTakenFinanceCourse: "yes" | "no" | "in_progress";
  financeFamiliarity: number;
  llmExperience: "none" | "rare" | "monthly" | "weekly" | "daily";
  notes: string;
}

export interface ParticipantStatus {
  token: string;
  profile?: ParticipantProfile;
  completionStatus: CompletionStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PromptCategory {
  id: string;
  title: string;
  instruction: string;
  example: string;
}

export interface ModelAnswer {
  label: AnswerLabel;
  modelId: ModelId;
  text: string;
}

export interface QualityRatings {
  correctness: number;
  completeness: number;
  professionalism: number;
  readability: number;
}

export interface EvaluationRecord {
  id: string;
  participantToken: string;
  participantProfile: ParticipantProfile;
  questionIndex: number;
  promptCategory: string;
  userQuestion: string;
  answers: Record<AnswerLabel, string>;
  hiddenModelMapping: Record<AnswerLabel, ModelId>;
  selectedBest: AnswerLabel;
  selectedWorst: AnswerLabel;
  bestReason: string;
  worstReason: string;
  qualityFlags: string[];
  qualityRatings: QualityRatings;
  timestamp: string;
  responseLatencyMs: number;
  completionStatus: "answered";
}
