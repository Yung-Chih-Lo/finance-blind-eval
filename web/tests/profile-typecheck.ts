// Type-level checks for ParticipantProfile / ParticipantProfileDraft / migrateLegacyProfile.
// Run via: cd web && npm run typecheck
//
// This file does not execute at runtime — it only forces the TypeScript compiler
// to validate the new profile schema and the legacy-migration helper signatures.

import type {
  EducationLevel,
  FinanceBackgroundType,
  Gender,
  ParticipantProfile,
  ParticipantProfileDraft,
} from "@/lib/evaluation/types"
import {
  isCompleteParticipantProfile,
  migrateLegacyProfile,
  validateParticipantProfile,
} from "@/lib/evaluation/profile"

// Section 2.1: every new required field is set; gradeOrOccupation is optional and omitted here.
const newShapeProfile: ParticipantProfile = {
  token: "P-NEW",
  ageRange: "25_29",
  gender: "female",
  educationLevel: "undergrad_in_progress",
  financeBackgroundType: "student_finance_related",
  financeWorkExperience: "internship",
  investmentExperience: "basic",
  financeFamiliarity: 4,
  llmExperience: "weekly",
  hasUsedAiForFinance: true,
  financeSubdomains: ["stocks", "funds_etf"],
  notes: "",
}
void newShapeProfile

// Draft tri-state: hasUsedAiForFinance MAY be null before the participant picks.
const draftProfile: ParticipantProfileDraft = {
  ...newShapeProfile,
  hasUsedAiForFinance: null,
}
void draftProfile

// Legacy storage rows arrive as unknown — migrateLegacyProfile must (a) compile,
// (b) return Partial<ParticipantProfile> stripped of legacy keys, (c) not invent
// values for new required fields.
const legacyRaw: unknown = {
  ageRange: "25_29",
  fieldOrWorkDomain: "資管系",
  isBusinessOrFinance: "yes",
  hasTakenFinanceCourse: "yes",
  financeLlmUsage: "weekly",
  financeFamiliarity: 4,
  financeWorkExperience: "internship",
  investmentExperience: "basic",
  llmExperience: "weekly",
  financeSubdomains: ["stocks"],
  notes: "",
}
const migrated: Partial<ParticipantProfile> = migrateLegacyProfile(legacyRaw)
void migrated

// Enum exhaustiveness — if any literal is renamed or removed, this errors.
const allGenders: Gender[] = ["female", "male", "non_binary_or_other", "prefer_not_to_say"]
const allEducation: EducationLevel[] = [
  "undergrad_in_progress",
  "undergrad_completed",
  "grad_or_above",
  "prefer_not_to_say",
]
const allBackground: FinanceBackgroundType[] = [
  "student_finance_related",
  "student_other",
  "working_finance_related",
  "working_other",
  "prefer_not_to_say",
]
void allGenders
void allEducation
void allBackground

// Section 3.1: validation accepts ParticipantProfileDraft (hasUsedAiForFinance may be null).
const issuesForDraft: string[] = validateParticipantProfile(draftProfile)
void issuesForDraft

// isCompleteParticipantProfile narrows draft → ParticipantProfile when validation passes.
const maybeComplete: ParticipantProfileDraft | null = null
if (isCompleteParticipantProfile(maybeComplete)) {
  const narrowed: ParticipantProfile = maybeComplete
  void narrowed
}
