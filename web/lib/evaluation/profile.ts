import type {
  AgeRange,
  FinanceLlmUsage,
  FinanceSubdomain,
  FinanceWorkExperience,
  InvestmentExperience,
  ParticipantProfile,
} from "@/lib/evaluation/types"

export const AGE_RANGE_OPTIONS: Array<{ value: AgeRange; label: string }> = [
  { value: "under_20", label: "未滿 20 歲" },
  { value: "20_24", label: "20-24 歲" },
  { value: "25_29", label: "25-29 歲" },
  { value: "30_39", label: "30-39 歲" },
  { value: "40_plus", label: "40 歲以上" },
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

export const FINANCE_LLM_USAGE_OPTIONS: Array<{ value: FinanceLlmUsage; label: string }> = [
  { value: "never", label: "幾乎不會用 AI 問金融問題" },
  { value: "tried", label: "偶爾嘗試，但不是固定習慣" },
  { value: "monthly", label: "每月數次" },
  { value: "weekly", label: "每週數次" },
  { value: "daily", label: "幾乎每天" },
]

export const FINANCE_SUBDOMAIN_OPTIONS: Array<{ value: FinanceSubdomain; label: string }> = [
  { value: "accounting", label: "會計 / 財報" },
  { value: "stocks", label: "股票 / 產業分析" },
  { value: "funds_etf", label: "基金 / ETF" },
  { value: "bonds_rates", label: "債券 / 利率" },
  { value: "macro_fx", label: "總經 / 匯率" },
  { value: "derivatives", label: "衍生性商品" },
  { value: "personal_finance", label: "個人理財" },
  { value: "risk_management", label: "風險管理" },
  { value: "not_sure", label: "不確定 / 無特別熟悉" },
]

const AGE_RANGE_VALUES = new Set(AGE_RANGE_OPTIONS.map((option) => option.value))
const FINANCE_WORK_EXPERIENCE_VALUES = new Set(FINANCE_WORK_EXPERIENCE_OPTIONS.map((option) => option.value))
const INVESTMENT_EXPERIENCE_VALUES = new Set(INVESTMENT_EXPERIENCE_OPTIONS.map((option) => option.value))
const FINANCE_LLM_USAGE_VALUES = new Set(FINANCE_LLM_USAGE_OPTIONS.map((option) => option.value))
const FINANCE_SUBDOMAIN_VALUES = new Set(FINANCE_SUBDOMAIN_OPTIONS.map((option) => option.value))

function hasChoice<T extends string>(value: unknown, allowed: Set<T>): value is T {
  return typeof value === "string" && allowed.has(value as T)
}

export function createParticipantProfileDraft(
  token: string,
  initialProfile?: Partial<ParticipantProfile> | null,
): ParticipantProfile {
  return {
    token,
    knownName: initialProfile?.knownName,
    ageRange: hasChoice(initialProfile?.ageRange, AGE_RANGE_VALUES) ? initialProfile.ageRange : "prefer_not_to_say",
    gradeOrOccupation: initialProfile?.gradeOrOccupation ?? "",
    fieldOrWorkDomain: initialProfile?.fieldOrWorkDomain ?? "",
    isBusinessOrFinance: initialProfile?.isBusinessOrFinance ?? "unsure",
    hasTakenFinanceCourse: initialProfile?.hasTakenFinanceCourse ?? "no",
    financeWorkExperience: hasChoice(initialProfile?.financeWorkExperience, FINANCE_WORK_EXPERIENCE_VALUES)
      ? initialProfile.financeWorkExperience
      : "none",
    investmentExperience: hasChoice(initialProfile?.investmentExperience, INVESTMENT_EXPERIENCE_VALUES)
      ? initialProfile.investmentExperience
      : "none",
    financeFamiliarity: initialProfile?.financeFamiliarity ?? 3,
    llmExperience: initialProfile?.llmExperience ?? "rare",
    financeLlmUsage: hasChoice(initialProfile?.financeLlmUsage, FINANCE_LLM_USAGE_VALUES)
      ? initialProfile.financeLlmUsage
      : "tried",
    financeSubdomains: Array.isArray(initialProfile?.financeSubdomains)
      ? initialProfile.financeSubdomains.filter((item): item is FinanceSubdomain => FINANCE_SUBDOMAIN_VALUES.has(item as FinanceSubdomain))
      : [],
    notes: initialProfile?.notes ?? "",
  }
}

export function validateParticipantProfile(profile: Partial<ParticipantProfile> | null | undefined): string[] {
  const issues: string[] = []
  if (!profile) {
    return ["請填寫背景資料。"]
  }
  if (!hasChoice(profile.ageRange, AGE_RANGE_VALUES)) {
    issues.push("請選擇年齡區間。")
  }
  if (!profile.gradeOrOccupation?.trim()) {
    issues.push("請填寫年級或職業。")
  }
  if (!profile.fieldOrWorkDomain?.trim()) {
    issues.push("請填寫主修、科系或工作領域。")
  }
  if (!["yes", "no", "unsure"].includes(profile.isBusinessOrFinance ?? "")) {
    issues.push("請選擇是否為商學院或金融相關背景。")
  }
  if (!["yes", "no", "in_progress"].includes(profile.hasTakenFinanceCourse ?? "")) {
    issues.push("請選擇金融課程或自學經驗。")
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
  if (!["none", "rare", "monthly", "weekly", "daily"].includes(profile.llmExperience ?? "")) {
    issues.push("請選擇 LLM / ChatGPT 使用頻率。")
  }
  if (!hasChoice(profile.financeLlmUsage, FINANCE_LLM_USAGE_VALUES)) {
    issues.push("請選擇使用 AI 處理金融任務的頻率。")
  }
  if (!Array.isArray(profile.financeSubdomains) || profile.financeSubdomains.length === 0) {
    issues.push("請至少選擇一個熟悉的金融子領域，或選擇不確定。")
  } else if (!profile.financeSubdomains.every((item) => FINANCE_SUBDOMAIN_VALUES.has(item as FinanceSubdomain))) {
    issues.push("金融子領域包含不支援的選項。")
  }
  return issues
}

export function isCompleteParticipantProfile(
  profile: Partial<ParticipantProfile> | null | undefined,
): profile is ParticipantProfile {
  return validateParticipantProfile(profile).length === 0
}

export function formatProfileChoice<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? value ?? "-"
}
