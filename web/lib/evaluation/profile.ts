import type {
  AgeRange,
  AiUsageFrequency,
  EducationLevel,
  MainDomain,
  ParticipantProfile,
  ParticipantProfileDraft,
} from "@/lib/evaluation/types"

export const AGE_RANGE_OPTIONS: Array<{ value: AgeRange; label: string }> = [
  { value: "20_24", label: "20-24 歲" },
  { value: "25_29", label: "25-29 歲" },
  { value: "30_39", label: "30-39 歲" },
  { value: "40_plus", label: "40 歲以上" },
]

export const EDUCATION_LEVEL_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: "undergrad_in_progress", label: "大學在學" },
  { value: "undergrad_completed", label: "大學畢業" },
  { value: "grad_or_above", label: "研究所在學或以上" },
]

export const MAIN_DOMAIN_OPTIONS: Array<{ value: MainDomain; label: string }> = [
  {
    value: "finance_related",
    label: "財經類學系或工作（金融/財管/經濟/會計/保險）",
  },
  {
    value: "business_non_finance",
    label: "商學或管理類但非財經（企管/資管/行銷/統計/國貿）",
  },
  {
    value: "other",
    label: "其他領域（文/理/工/法/社科/藝術等）",
  },
]

export const AI_USAGE_FREQUENCY_OPTIONS: Array<{ value: AiUsageFrequency; label: string }> = [
  { value: "never", label: "從未" },
  { value: "occasional", label: "偶爾（每月幾次以下）" },
  { value: "frequent", label: "經常（每週幾次）" },
  { value: "daily", label: "每天" },
]

const AGE_RANGE_VALUES = new Set(AGE_RANGE_OPTIONS.map((option) => option.value))
const EDUCATION_LEVEL_VALUES = new Set(EDUCATION_LEVEL_OPTIONS.map((option) => option.value))
const MAIN_DOMAIN_VALUES = new Set(MAIN_DOMAIN_OPTIONS.map((option) => option.value))
const AI_USAGE_FREQUENCY_VALUES = new Set(AI_USAGE_FREQUENCY_OPTIONS.map((option) => option.value))

function hasChoice<T extends string>(value: unknown, allowed: Set<T>): value is T {
  return typeof value === "string" && allowed.has(value as T)
}

export function createParticipantProfileDraft(
  token: string,
  initialProfile?: Partial<ParticipantProfile> | Partial<ParticipantProfileDraft> | null,
): ParticipantProfileDraft {
  // Every field starts as null when the stored value doesn't match a current option.
  // Validation rejects null so the participant must explicitly pick. There is no
  // "prefer_not_to_say" escape on any field — all 5 are required for stratification.
  const initialHasUsedAi = (initialProfile as Partial<ParticipantProfileDraft> | null | undefined)?.hasUsedAiForFinance
  return {
    token,
    ageRange: hasChoice(initialProfile?.ageRange, AGE_RANGE_VALUES) ? initialProfile.ageRange : null,
    educationLevel: hasChoice(initialProfile?.educationLevel, EDUCATION_LEVEL_VALUES)
      ? initialProfile.educationLevel
      : null,
    mainDomain: hasChoice(initialProfile?.mainDomain, MAIN_DOMAIN_VALUES) ? initialProfile.mainDomain : null,
    aiUsageFrequency: hasChoice(initialProfile?.aiUsageFrequency, AI_USAGE_FREQUENCY_VALUES)
      ? initialProfile.aiUsageFrequency
      : null,
    hasUsedAiForFinance: typeof initialHasUsedAi === "boolean" ? initialHasUsedAi : null,
  }
}

export function validateParticipantProfile(
  profile: Partial<ParticipantProfileDraft> | null | undefined,
): string[] {
  const issues: string[] = []
  if (!profile) {
    return ["請填寫背景資料。"]
  }
  // token is server-issued and required for the type predicate to soundly narrow to
  // ParticipantProfile. A draft without a non-empty token slipped through earlier
  // because `validateParticipantProfile` only checked the 5 enum/boolean fields.
  if (typeof profile.token !== "string" || profile.token.trim() === "") {
    issues.push("缺少 participant token。")
  }
  if (!hasChoice(profile.ageRange, AGE_RANGE_VALUES)) {
    issues.push("請選擇年齡區間。")
  }
  if (!hasChoice(profile.educationLevel, EDUCATION_LEVEL_VALUES)) {
    issues.push("請選擇最高學歷。")
  }
  if (!hasChoice(profile.mainDomain, MAIN_DOMAIN_VALUES)) {
    issues.push("請選擇目前主要領域。")
  }
  if (!hasChoice(profile.aiUsageFrequency, AI_USAGE_FREQUENCY_VALUES)) {
    issues.push("請選擇 AI 使用頻率。")
  }
  if (profile.hasUsedAiForFinance !== true && profile.hasUsedAiForFinance !== false) {
    issues.push("請選擇是否曾用 AI 處理金融問題。")
  }
  return issues
}

export function isCompleteParticipantProfile(
  profile: Partial<ParticipantProfileDraft> | null | undefined,
): profile is ParticipantProfile {
  return validateParticipantProfile(profile).length === 0
}

// Server-side projection from a validated draft to the exact 6-key persisted shape.
// The only line of defense against an old / malicious client POSTing rogue keys
// (gender, financeBackgroundType, llmExperience, financeFamiliarity, etc.) and
// having them silently leak into the store. Lifted out of `app/api/session/route.ts`
// so it can be unit-tested by the verify harness — see verify-profile-validation.ts
// `testBuildPersistedProfileDropsRogueKeys`.
export function buildPersistedProfile(token: string, raw: ParticipantProfile): ParticipantProfile {
  return {
    token,
    ageRange: raw.ageRange,
    educationLevel: raw.educationLevel,
    mainDomain: raw.mainDomain,
    aiUsageFrequency: raw.aiUsageFrequency,
    hasUsedAiForFinance: raw.hasUsedAiForFinance,
  }
}

export function formatProfileChoice<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T | undefined,
) {
  // Fall back to "-" rather than `value ?? "-"` so a stored row carrying a removed
  // legacy enum literal (e.g. mainDomain = "student_finance_related" left over from
  // the schema v1 era) renders as "-" instead of leaking the raw token into admin UI.
  return options.find((option) => option.value === value)?.label ?? "-"
}
