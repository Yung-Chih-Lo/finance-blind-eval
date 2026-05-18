import type {
  AgeRange,
  EducationLevel,
  FinanceBackgroundType,
  FinanceSubdomain,
  FinanceWorkExperience,
  Gender,
  InvestmentExperience,
  ParticipantProfile,
  ParticipantProfileDraft,
} from "@/lib/evaluation/types"

export const AGE_RANGE_OPTIONS: Array<{ value: AgeRange; label: string }> = [
  { value: "20_24", label: "20-24 歲" },
  { value: "25_29", label: "25-29 歲" },
  { value: "30_39", label: "30-39 歲" },
  { value: "40_plus", label: "40 歲以上" },
  { value: "prefer_not_to_say", label: "不願透露" },
]

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "non_binary_or_other", label: "非二元或其他" },
  { value: "prefer_not_to_say", label: "不願透露" },
]

export const EDUCATION_LEVEL_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: "undergrad_in_progress", label: "大學在學" },
  { value: "undergrad_completed", label: "大學畢業" },
  { value: "grad_or_above", label: "研究所在學或以上" },
  { value: "prefer_not_to_say", label: "不願透露" },
]

export const FINANCE_BACKGROUND_TYPE_OPTIONS: Array<{ value: FinanceBackgroundType; label: string }> = [
  { value: "student_finance_related", label: "學生：商管、金融、會計、經濟相關" },
  { value: "student_other", label: "學生：非上述領域" },
  { value: "working_finance_related", label: "工作者：金融、會計、投資、銀行、保險、證券相關" },
  { value: "working_other", label: "工作者：非上述領域" },
  { value: "prefer_not_to_say", label: "不願透露" },
]

export const FINANCE_WORK_EXPERIENCE_OPTIONS: Array<{ value: FinanceWorkExperience; label: string }> = [
  { value: "none", label: "沒有相關經驗" },
  { value: "course_project", label: "課程 / 專題經驗" },
  { value: "internship", label: "金融相關實習 / 兼職" },
  { value: "professional", label: "金融相關正職經驗" },
  { value: "prefer_not_to_say", label: "不願透露" },
]

export const INVESTMENT_EXPERIENCE_OPTIONS: Array<{ value: InvestmentExperience; label: string }> = [
  { value: "none", label: "沒有投資經驗" },
  { value: "basic", label: "有基本理財 / 基金 / ETF 經驗" },
  { value: "regular", label: "會定期追蹤或交易金融商品" },
  { value: "advanced", label: "熟悉多種商品或進階投資分析" },
  { value: "prefer_not_to_say", label: "不願透露" },
]

export const FINANCE_SUBDOMAIN_OPTIONS: Array<{ value: FinanceSubdomain; label: string }> = [
  { value: "accounting", label: "會計 / 財報" },
  { value: "stocks", label: "股票 / 產業分析" },
  { value: "funds_etf", label: "基金 / ETF" },
  { value: "bonds_rates", label: "債券 / 利率" },
  { value: "macro_fx", label: "總經 / 匯率" },
  { value: "personal_finance", label: "個人理財" },
  { value: "not_sure", label: "都不熟悉 / 沒接觸過" },
]

const AGE_RANGE_VALUES = new Set(AGE_RANGE_OPTIONS.map((option) => option.value))
const GENDER_VALUES = new Set(GENDER_OPTIONS.map((option) => option.value))
const EDUCATION_LEVEL_VALUES = new Set(EDUCATION_LEVEL_OPTIONS.map((option) => option.value))
const FINANCE_BACKGROUND_TYPE_VALUES = new Set(FINANCE_BACKGROUND_TYPE_OPTIONS.map((option) => option.value))
const FINANCE_WORK_EXPERIENCE_VALUES = new Set(FINANCE_WORK_EXPERIENCE_OPTIONS.map((option) => option.value))
const INVESTMENT_EXPERIENCE_VALUES = new Set(INVESTMENT_EXPERIENCE_OPTIONS.map((option) => option.value))
const FINANCE_SUBDOMAIN_VALUES = new Set(FINANCE_SUBDOMAIN_OPTIONS.map((option) => option.value))
const LLM_EXPERIENCE_VALUES = new Set<ParticipantProfile["llmExperience"]>([
  "none",
  "rare",
  "monthly",
  "weekly",
  "daily",
])

function hasChoice<T extends string>(value: unknown, allowed: Set<T>): value is T {
  return typeof value === "string" && allowed.has(value as T)
}

export function createParticipantProfileDraft(
  token: string,
  initialProfile?: Partial<ParticipantProfile> | Partial<ParticipantProfileDraft> | null,
): ParticipantProfileDraft {
  const initialHasUsedAi = (initialProfile as Partial<ParticipantProfileDraft> | null | undefined)?.hasUsedAiForFinance
  // Every required field starts as null when the stored value doesn't match a current
  // option. Validation rejects null so the participant must explicitly pick (including
  // "不願透露" / "no relevant experience" if that's their honest answer). This avoids
  // silent defaults contaminating the analysis — especially for financeWorkExperience
  // which is the pre-registered primary stratifier (D2).
  return {
    token,
    knownName: initialProfile?.knownName,
    ageRange: hasChoice(initialProfile?.ageRange, AGE_RANGE_VALUES) ? initialProfile.ageRange : "prefer_not_to_say",
    gender: hasChoice(initialProfile?.gender, GENDER_VALUES) ? initialProfile.gender : null,
    educationLevel: hasChoice(initialProfile?.educationLevel, EDUCATION_LEVEL_VALUES)
      ? initialProfile.educationLevel
      : null,
    financeBackgroundType: hasChoice(initialProfile?.financeBackgroundType, FINANCE_BACKGROUND_TYPE_VALUES)
      ? initialProfile.financeBackgroundType
      : null,
    gradeOrOccupation: initialProfile?.gradeOrOccupation ?? "",
    financeWorkExperience: hasChoice(initialProfile?.financeWorkExperience, FINANCE_WORK_EXPERIENCE_VALUES)
      ? initialProfile.financeWorkExperience
      : null,
    investmentExperience: hasChoice(initialProfile?.investmentExperience, INVESTMENT_EXPERIENCE_VALUES)
      ? initialProfile.investmentExperience
      : null,
    financeFamiliarity: initialProfile?.financeFamiliarity ?? 3,
    llmExperience: initialProfile?.llmExperience ?? "rare",
    hasUsedAiForFinance: typeof initialHasUsedAi === "boolean" ? initialHasUsedAi : null,
    financeSubdomains: Array.isArray(initialProfile?.financeSubdomains)
      ? initialProfile.financeSubdomains.filter((item): item is FinanceSubdomain =>
          FINANCE_SUBDOMAIN_VALUES.has(item as FinanceSubdomain),
        )
      : [],
    notes: initialProfile?.notes ?? "",
  }
}

export function validateParticipantProfile(
  profile: Partial<ParticipantProfileDraft> | null | undefined,
): string[] {
  const issues: string[] = []
  if (!profile) {
    return ["請填寫背景資料。"]
  }
  if (!hasChoice(profile.gender, GENDER_VALUES)) {
    issues.push("請選擇性別（可選擇不願透露）。")
  }
  if (!hasChoice(profile.ageRange, AGE_RANGE_VALUES)) {
    issues.push("請選擇年齡區間。")
  }
  if (!hasChoice(profile.educationLevel, EDUCATION_LEVEL_VALUES)) {
    issues.push("請選擇最高學歷。")
  }
  if (!hasChoice(profile.financeBackgroundType, FINANCE_BACKGROUND_TYPE_VALUES)) {
    issues.push("請選擇金融背景類型。")
  }
  if (!hasChoice(profile.financeWorkExperience, FINANCE_WORK_EXPERIENCE_VALUES)) {
    issues.push("請選擇金融工作或實習經驗。")
  }
  if (!hasChoice(profile.investmentExperience, INVESTMENT_EXPERIENCE_VALUES)) {
    issues.push("請選擇投資經驗。")
  }
  if (typeof profile.financeFamiliarity !== "number" || profile.financeFamiliarity < 1 || profile.financeFamiliarity > 5) {
    issues.push("請選擇 1-5 的金融熟悉程度。")
  }
  if (!hasChoice(profile.llmExperience, LLM_EXPERIENCE_VALUES)) {
    issues.push("請選擇 LLM / ChatGPT 使用頻率。")
  }
  if (profile.hasUsedAiForFinance !== true && profile.hasUsedAiForFinance !== false) {
    issues.push("請選擇是否曾用 AI 處理金融問題。")
  }
  if (!Array.isArray(profile.financeSubdomains) || profile.financeSubdomains.length === 0) {
    issues.push("請至少選擇一個熟悉的金融子領域，或選擇『都不熟悉 / 沒接觸過』。")
  } else if (!profile.financeSubdomains.every((item) => FINANCE_SUBDOMAIN_VALUES.has(item as FinanceSubdomain))) {
    issues.push("金融子領域包含不支援的選項。")
  }
  return issues
}

export function isCompleteParticipantProfile(
  profile: Partial<ParticipantProfileDraft> | null | undefined,
): profile is ParticipantProfile {
  return validateParticipantProfile(profile).length === 0
}

export function formatProfileChoice<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? value ?? "-"
}

const LEGACY_FIELDS = ["fieldOrWorkDomain", "isBusinessOrFinance", "hasTakenFinanceCourse", "financeLlmUsage"] as const

// Canonical read-side normalizer for ANY persisted profile. Despite the name, this
// handles both schemas:
//   - Legacy input (has fieldOrWorkDomain / isBusinessOrFinance / etc., lacks new
//     required fields): legacy keys are dropped; new required fields stay absent so
//     the partial result is recognized by `isLegacyShape` (app/api/session/route.ts)
//     and triggers the legacy → new-shape form re-prompt.
//   - New-shape input (already has gender / educationLevel / financeBackgroundType /
//     hasUsedAiForFinance): those fields are preserved verbatim so a returning
//     participant who already submitted reads back an identical profile.
// In both cases: under_20 ageRange is remapped to prefer_not_to_say, and any field
// that fails its option-set check is silently dropped.
export function migrateLegacyProfile(raw: unknown): Partial<ParticipantProfile> {
  if (!raw || typeof raw !== "object") return {}
  const obj = raw as Record<string, unknown>
  const out: Partial<ParticipantProfile> = {}

  if (typeof obj.token === "string") {
    out.token = obj.token
  }
  if (typeof obj.knownName === "string") {
    out.knownName = obj.knownName
  }

  const rawAgeRange = typeof obj.ageRange === "string" ? obj.ageRange : ""
  if (rawAgeRange === "under_20") {
    out.ageRange = "prefer_not_to_say"
  } else if (hasChoice(rawAgeRange, AGE_RANGE_VALUES)) {
    out.ageRange = rawAgeRange
  }

  if (typeof obj.gradeOrOccupation === "string") {
    out.gradeOrOccupation = obj.gradeOrOccupation
  }

  if (hasChoice(obj.financeWorkExperience, FINANCE_WORK_EXPERIENCE_VALUES)) {
    out.financeWorkExperience = obj.financeWorkExperience
  }

  if (hasChoice(obj.investmentExperience, INVESTMENT_EXPERIENCE_VALUES)) {
    out.investmentExperience = obj.investmentExperience
  }

  if (typeof obj.financeFamiliarity === "number" && obj.financeFamiliarity >= 1 && obj.financeFamiliarity <= 5) {
    out.financeFamiliarity = obj.financeFamiliarity
  }

  if (hasChoice(obj.llmExperience, LLM_EXPERIENCE_VALUES)) {
    out.llmExperience = obj.llmExperience
  }

  if (Array.isArray(obj.financeSubdomains)) {
    out.financeSubdomains = obj.financeSubdomains.filter((item): item is FinanceSubdomain =>
      FINANCE_SUBDOMAIN_VALUES.has(item as FinanceSubdomain),
    )
  }

  if (typeof obj.notes === "string") {
    out.notes = obj.notes
  }

  // Preserve the new required fields when the input already has them (i.e. a new-shape
  // profile being read back from storage). For genuine legacy inputs these keys are
  // absent in `obj`, so the assignments below no-op — leaving the partial in the
  // "needs re-prompt" state that `isLegacyShape` keys off of.
  if (hasChoice(obj.gender, GENDER_VALUES)) {
    out.gender = obj.gender
  }
  if (hasChoice(obj.educationLevel, EDUCATION_LEVEL_VALUES)) {
    out.educationLevel = obj.educationLevel
  }
  if (hasChoice(obj.financeBackgroundType, FINANCE_BACKGROUND_TYPE_VALUES)) {
    out.financeBackgroundType = obj.financeBackgroundType
  }
  if (typeof obj.hasUsedAiForFinance === "boolean") {
    out.hasUsedAiForFinance = obj.hasUsedAiForFinance
  }
  return out
}

// Snapshot of the legacy fields preserved verbatim from a stored profile so admin
// exports can still surface the legacy cohort's original answers — see design D9.
// Derived from LEGACY_FIELDS so adding a new entry to LEGACY_FIELDS automatically
// extends the snapshot shape.
export type LegacyProfileSnapshot = {
  [K in (typeof LEGACY_FIELDS)[number]]?: string
}

// Coerces legacy field values to strings via String(). Older on-disk records might
// have persisted booleans / numbers for these fields; without coercion the snapshot
// would silently drop them and the legacy_* CSV / legacyProfile JSON block would be
// empty — violating spec D9's "emit verbatim" requirement.
export function extractLegacyProfileSnapshot(raw: unknown): LegacyProfileSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const obj = raw as Record<string, unknown>
  const snapshot: LegacyProfileSnapshot = {}
  for (const field of LEGACY_FIELDS) {
    const value = obj[field]
    if (value === undefined || value === null) continue
    const stringified = String(value)
    if (stringified === "") continue
    snapshot[field] = stringified
  }
  return Object.keys(snapshot).length > 0 ? snapshot : undefined
}
