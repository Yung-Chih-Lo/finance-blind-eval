import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { EVALUATION_FACETS, MODEL_IDS, WORST_ANSWER_FLAGS } from "@/lib/evaluation/config"
import { extractLegacyProfileSnapshot, migrateLegacyProfile } from "@/lib/evaluation/profile"
import type {
  AdminAttentionItems,
  AdminFunnelStages,
  AdminSnapshot,
  AnswerLabel,
  EvaluationRecord,
  EvaluationSession,
  EvaluationStore,
  ModelComparisonCounts,
  ModelId,
  ParticipantProfile,
  ParticipantStatus,
  PendingQuestion,
  PlatformSettingsSnapshot,
  StudyConfig,
} from "@/lib/evaluation/types"

// 研究者一眼能掃完的長度 — 調整時注意 attention list UI 的視覺密度
const TOP_WORST_FLAGS = 3
const MAX_LATENCY_OUTLIERS = 5
const MAX_STALLED_PARTICIPANTS = 5

const EMPTY_STORE: EvaluationStore = {
  participants: [],
  sessions: [],
  pendingQuestions: [],
  records: [],
}

let memoryStore: EvaluationStore = structuredClone(EMPTY_STORE)

// Serializes read-modify-write store mutations so concurrent requests (e.g.
// a participant double-clicking 完成 on the final question) don't both read
// the same snapshot and overwrite each other.
let mutateQueue: Promise<unknown> = Promise.resolve()

async function withStoreMutex<T>(work: () => Promise<T>): Promise<T> {
  const previous = mutateQueue.catch(() => undefined)
  let release!: () => void
  mutateQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await previous
    return await work()
  } finally {
    release()
  }
}

function cloneStore(store: EvaluationStore): EvaluationStore {
  return {
    participants: [...store.participants],
    sessions: [...store.sessions],
    pendingQuestions: [...store.pendingQuestions],
    records: [...store.records],
  }
}

function dataPath() {
  const fileName = basename(process.env.EVALUATION_DATA_FILE || "evaluation-store.json")
  return join(process.cwd(), ".data", fileName)
}

async function readStore(): Promise<EvaluationStore> {
  try {
    const raw = await readFile(dataPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<EvaluationStore>
    return {
      participants: Array.isArray(parsed.participants) ? parsed.participants : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      pendingQuestions: Array.isArray(parsed.pendingQuestions) ? parsed.pendingQuestions : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
    }
  } catch {
    return cloneStore(memoryStore)
  }
}

async function writeStore(store: EvaluationStore): Promise<void> {
  memoryStore = cloneStore(store)

  try {
    const path = dataPath()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8")
  } catch {
    // File writes can fail in some deploy environments. The in-memory copy keeps
    // local development and tests usable until a durable database is configured.
  }
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function normalizeToken(value: string) {
  return value.trim().toUpperCase()
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function randomCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

function createAnonymousParticipantToken() {
  return `P-${randomCode(8)}`
}

export async function resetEvaluationData() {
  await withStoreMutex(() => writeStore(structuredClone(EMPTY_STORE)))
}

async function getUsedParticipantTokens(store: EvaluationStore) {
  return new Set([
    ...store.participants.map((participant) => participant.token),
    ...store.pendingQuestions.map((question) => question.participantToken),
    ...store.records.map((record) => record.participantToken),
  ])
}

export async function createAnonymousParticipantSession(
  options: { sessionTtlDays?: number } = {},
): Promise<{ participant: ParticipantStatus; sessionToken: string; session: EvaluationSession }> {
  return withStoreMutex(async () => {
    const store = await readStore()
    const now = new Date()

    const usedTokens = await getUsedParticipantTokens(store)
    let token = ""
    for (let attempts = 0; attempts < 200; attempts += 1) {
      const candidate = createAnonymousParticipantToken()
      if (!usedTokens.has(candidate)) {
        token = candidate
        break
      }
    }
    if (!token) {
      throw new Error("Unable to allocate participant token.")
    }

    const createdAt = now.toISOString()
    const participant: ParticipantStatus = {
      token,
      completionStatus: "profile_started",
      startedAt: createdAt,
      updatedAt: createdAt,
    }
    const sessionToken = randomBytes(32).toString("base64url")
    const expiresAt = new Date(now.getTime() + (options.sessionTtlDays ?? 14) * 24 * 60 * 60 * 1000).toISOString()
    const session: EvaluationSession = {
      id: randomBytes(12).toString("base64url"),
      sessionHash: hashSecret(sessionToken),
      participantToken: token,
      createdAt,
      lastSeenAt: createdAt,
      expiresAt,
    }

    await writeStore({
      ...store,
      sessions: [...store.sessions, session],
      participants: [...store.participants, participant],
    })

    return { participant, sessionToken, session }
  })
}

export async function getSessionByToken(sessionToken: string): Promise<EvaluationSession | undefined> {
  if (!sessionToken) {
    return undefined
  }
  const store = await readStore()
  const sessionHash = hashSecret(sessionToken)
  const session = store.sessions.find((item) => item.sessionHash === sessionHash)
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    return undefined
  }
  return session
}

export async function touchSession(sessionId: string): Promise<void> {
  await withStoreMutex(async () => {
    const store = await readStore()
    const now = new Date().toISOString()
    await writeStore({
      ...store,
      sessions: store.sessions.map((session) => (session.id === sessionId ? { ...session, lastSeenAt: now } : session)),
    })
  })
}

// On read we strip legacy profile fields so consumers only see the current schema.
// migrateLegacyProfile returns Partial<ParticipantProfile>; we cast back to ParticipantProfile
// to match the established convention (storage type is permissive — UIs already handle
// undefined optional fields via `?? "-"`). The "missing new required fields" condition
// is what the legacy-shape→form-prefill scenario keys off of (see spec).
function migrateParticipantProfile(profile: ParticipantStatus["profile"]): ParticipantStatus["profile"] {
  if (!profile) return profile
  const migrated = migrateLegacyProfile(profile)
  return migrated as ParticipantProfile
}

function migrateParticipantStatus(status: ParticipantStatus): ParticipantStatus {
  return { ...status, profile: migrateParticipantProfile(status.profile) }
}

export async function getParticipantStatuses(): Promise<ParticipantStatus[]> {
  return (await readStore()).participants.map(migrateParticipantStatus)
}

export async function getParticipantStatus(token: string): Promise<ParticipantStatus | undefined> {
  const normalizedToken = normalizeToken(token)
  const match = (await readStore()).participants.find((participant) => participant.token === normalizedToken)
  return match ? migrateParticipantStatus(match) : undefined
}

export async function clearPendingQuestionsForParticipant(token: string): Promise<void> {
  const normalizedToken = normalizeToken(token)
  await withStoreMutex(async () => {
    const store = await readStore()
    const next = store.pendingQuestions.filter(
      (question) => normalizeToken(question.participantToken) !== normalizedToken,
    )
    if (next.length === store.pendingQuestions.length) {
      return
    }
    await writeStore({
      ...store,
      pendingQuestions: next,
    })
  })
}

export async function upsertParticipantStatus(status: ParticipantStatus): Promise<ParticipantStatus> {
  const normalizedStatus: ParticipantStatus = {
    ...status,
    token: normalizeToken(status.token),
    profile: status.profile ? { ...status.profile, token: normalizeToken(status.profile.token) } : undefined,
  }
  await withStoreMutex(async () => {
    const store = await readStore()
    const existing = store.participants.filter((participant) => participant.token !== normalizedStatus.token)
    await writeStore({
      ...store,
      participants: [...existing, normalizedStatus],
    })
  })
  return normalizedStatus
}

export async function savePendingQuestion(question: PendingQuestion): Promise<PendingQuestion> {
  await withStoreMutex(async () => {
    const store = await readStore()
    const existing = store.pendingQuestions.filter((item) => item.id !== question.id)
    await writeStore({
      ...store,
      pendingQuestions: [...existing, question],
    })
  })
  return question
}

export async function getPendingQuestion(questionId: string): Promise<PendingQuestion | undefined> {
  return (await readStore()).pendingQuestions.find((question) => question.id === questionId)
}

export async function deletePendingQuestion(
  questionId: string,
  participantToken: string,
): Promise<{ status: "deleted" | "not_found" | "forbidden" }> {
  const expectedToken = normalizeToken(participantToken)
  return withStoreMutex(async () => {
    const store = await readStore()
    const existing = store.pendingQuestions.find((question) => question.id === questionId)
    if (!existing) {
      return { status: "not_found" }
    }
    if (normalizeToken(existing.participantToken) !== expectedToken) {
      return { status: "forbidden" }
    }
    await writeStore({
      ...store,
      pendingQuestions: store.pendingQuestions.filter((question) => question.id !== questionId),
    })
    return { status: "deleted" }
  })
}

export async function saveEvaluationRecord(record: EvaluationRecord): Promise<EvaluationRecord> {
  await withStoreMutex(async () => {
    const store = await readStore()
    const existingRecords = store.records.filter((item) => item.id !== record.id)
    // Pending row shares the same id as the saved record (see POST /api/evaluation/answers).
    // QuestionFlow's saveJudgment relies on this to skip a redundant DELETE call.
    const pendingQuestions = store.pendingQuestions.filter((item) => item.id !== record.id)
    await writeStore({
      ...store,
      pendingQuestions,
      records: [...existingRecords, record],
    })
  })
  return record
}

export async function getEvaluationRecords(): Promise<EvaluationRecord[]> {
  return (await readStore()).records
}

export async function getEvaluationRecordsByParticipant(participantToken: string): Promise<EvaluationRecord[]> {
  const token = normalizeToken(participantToken)
  return (await readStore()).records.filter((record) => record.participantToken === token)
}

export async function getPendingQuestionsByParticipant(participantToken: string): Promise<PendingQuestion[]> {
  const token = normalizeToken(participantToken)
  return (await readStore()).pendingQuestions.filter((question) => question.participantToken === token)
}

function modelIdsFromConfig(config?: Pick<StudyConfig, "modelIds">) {
  return config?.modelIds ?? MODEL_IDS
}

function facetsFromConfig(config?: Pick<StudyConfig, "evaluationFacets">) {
  return config?.evaluationFacets ?? EVALUATION_FACETS
}

function worstFlagsFromConfig(config?: Pick<StudyConfig, "worstAnswerFlags">) {
  return config?.worstAnswerFlags ?? WORST_ANSWER_FLAGS
}

export function countModelSelections(
  records: EvaluationRecord[],
  config?: Pick<StudyConfig, "modelIds">,
): Record<ModelId, { best: number; worst: number }> {
  const counts = Object.fromEntries(
    modelIdsFromConfig(config).map((modelId) => [modelId, { best: 0, worst: 0 }]),
  ) as Record<ModelId, { best: number; worst: number }>

  records.forEach((record) => {
    counts[record.hiddenModelMapping[record.selectedBest]] ??= { best: 0, worst: 0 }
    counts[record.hiddenModelMapping[record.selectedWorst]] ??= { best: 0, worst: 0 }
    counts[record.hiddenModelMapping[record.selectedBest]].best += 1
    counts[record.hiddenModelMapping[record.selectedWorst]].worst += 1
  })

  return counts
}

function emptyModelComparisonCounts(): ModelComparisonCounts {
  return {
    overallBest: 0,
    overallWorst: 0,
    net: 0,
    correctness: 0,
    reasoning: 0,
    completeness: 0,
    readability: 0,
  }
}

export function countComparativeSelections(
  records: EvaluationRecord[],
  config?: Pick<StudyConfig, "modelIds" | "evaluationFacets">,
): Record<ModelId, ModelComparisonCounts> {
  const counts = Object.fromEntries(
    modelIdsFromConfig(config).map((modelId) => [modelId, emptyModelComparisonCounts()]),
  ) as Record<ModelId, ModelComparisonCounts>

  records.forEach((record) => {
    counts[record.hiddenModelMapping[record.selectedBest]] ??= emptyModelComparisonCounts()
    counts[record.hiddenModelMapping[record.selectedWorst]] ??= emptyModelComparisonCounts()
    counts[record.hiddenModelMapping[record.selectedBest]].overallBest += 1
    counts[record.hiddenModelMapping[record.selectedWorst]].overallWorst += 1

    facetsFromConfig(config).forEach((facet) => {
      const selectedLabel = record.facetSelections?.[facet.id]
      if (selectedLabel) {
        counts[record.hiddenModelMapping[selectedLabel]] ??= emptyModelComparisonCounts()
        counts[record.hiddenModelMapping[selectedLabel]][facet.id] += 1
      }
    })
  })

  const countedModelIds = Object.keys(counts) as ModelId[]
  countedModelIds.forEach((modelId) => {
    counts[modelId].net = counts[modelId].overallBest - counts[modelId].overallWorst
  })

  return counts
}

export function countWorstFlags(
  records: EvaluationRecord[],
  config?: Pick<StudyConfig, "modelIds" | "worstAnswerFlags">,
): Record<ModelId, Record<string, number>> {
  const emptyFlags = Object.fromEntries(worstFlagsFromConfig(config).map((flag) => [flag.id, 0]))
  const counts = Object.fromEntries(
    modelIdsFromConfig(config).map((modelId) => [modelId, { ...emptyFlags }]),
  ) as Record<ModelId, Record<string, number>>

  records.forEach((record) => {
    const modelId = record.hiddenModelMapping[record.selectedWorst]
    counts[modelId] ??= { ...emptyFlags }
    const flags = record.worstAnswerFlags ?? []
    flags.forEach((flag) => {
      counts[modelId][flag] = (counts[modelId][flag] ?? 0) + 1
    })
  })

  return counts
}

export function labelsFromMapping(mapping: Record<AnswerLabel, ModelId>): string {
  return `A=${mapping.A}, B=${mapping.B}, C=${mapping.C}`
}

function resolveModel(record: EvaluationRecord, label?: AnswerLabel): ModelId | "" {
  return label ? record.hiddenModelMapping[label] : ""
}

function resolveGatewayModel(record: EvaluationRecord, label?: AnswerLabel): string {
  return label ? record.gatewayModelMapping[label] : ""
}

function computeFunnelStages(
  participants: ParticipantStatus[],
  records: EvaluationRecord[],
): AdminFunnelStages {
  const redeemed = participants.length
  const profileCompleted = participants.filter((participant) => participant.profile != null).length
  const tokensWithRecords = new Set(records.map((record) => record.participantToken))
  const answeredAny = tokensWithRecords.size
  const completed = participants.filter((participant) => participant.completionStatus === "completed").length
  return { redeemed, profileCompleted, answeredAny, completed }
}

function computeLatencyP95(records: EvaluationRecord[]): number {
  if (records.length === 0) return 0
  const sorted = records.map((record) => record.responseLatencyMs).sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
}

function computeAttentionItems(
  participants: ParticipantStatus[],
  records: EvaluationRecord[],
  worstFlagCounts: Record<ModelId, Record<string, number>>,
  latencyP95: number,
  config?: Pick<StudyConfig, "worstAnswerFlags">,
): AdminAttentionItems {
  const flagDefinitions = worstFlagsFromConfig(config)
  const flagLabelById = new Map<string, string>(
    flagDefinitions.map((flag) => [flag.id, flag.label]),
  )

  const topWorstFlags: AdminAttentionItems["topWorstFlags"] = []
  for (const modelId of Object.keys(worstFlagCounts) as ModelId[]) {
    const flagMap = worstFlagCounts[modelId]
    for (const [flagId, count] of Object.entries(flagMap)) {
      if (count > 0) {
        topWorstFlags.push({
          flagId,
          flagLabel: flagLabelById.get(flagId) ?? flagId,
          modelId,
          count,
        })
      }
    }
  }
  // Tiebreaker: count desc, then modelId then flagId ascending — keeps ordering stable across reloads
  topWorstFlags.sort(
    (a, b) =>
      b.count - a.count ||
      a.modelId.localeCompare(b.modelId) ||
      a.flagId.localeCompare(b.flagId),
  )

  // `>=` keeps the boundary record when n is small (p95 equals an existing value);
  // sorted dedupe by recordId in case the threshold matches multiple entries.
  const seenRecordIds = new Set<string>()
  const latencyOutliers = records
    .filter((record) => latencyP95 > 0 && record.responseLatencyMs >= latencyP95)
    .sort((a, b) => b.responseLatencyMs - a.responseLatencyMs)
    .filter((record) => {
      if (seenRecordIds.has(record.id)) return false
      seenRecordIds.add(record.id)
      return true
    })
    .slice(0, MAX_LATENCY_OUTLIERS)
    .map((record) => ({
      recordId: record.id,
      latencyMs: record.responseLatencyMs,
      participantToken: record.participantToken,
      questionIndex: record.questionIndex,
    }))

  const recordsByToken = new Map<string, number>()
  for (const record of records) {
    recordsByToken.set(record.participantToken, (recordsByToken.get(record.participantToken) ?? 0) + 1)
  }
  // "Started but not completed" includes redeemed-but-no-profile early dropouts —
  // those are the most important group to follow up with, so do NOT require a profile.
  const stalledParticipants = participants
    .filter((participant) => participant.completionStatus !== "completed")
    .slice()
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, MAX_STALLED_PARTICIPANTS)
    .map((participant) => ({
      token: participant.token,
      lastActivityAt: participant.updatedAt,
      answeredCount: recordsByToken.get(participant.token) ?? 0,
    }))

  return {
    topWorstFlags: topWorstFlags.slice(0, TOP_WORST_FLAGS),
    latencyOutliers,
    stalledParticipants,
  }
}

export async function getAdminSnapshot(config?: StudyConfig): Promise<AdminSnapshot> {
  const store = await readStore()
  // Migrate participant profiles at the snapshot boundary so UI consumers only see the
  // current schema; raw legacy fields stay in store.records for export use (D9).
  const participants = store.participants.map(migrateParticipantStatus)
  const worstFlagCounts = countWorstFlags(store.records, config)
  const latencyP95 = computeLatencyP95(store.records)

  // financeBackgroundType drives the four mutually-exclusive KPI buckets. Legacy
  // records that lack the field fall into unknownBackgroundCount.
  const FINANCE_RELEVANT = new Set(["student_finance_related", "working_finance_related"])
  const NON_FINANCE = new Set(["student_other", "working_other"])
  let financeBackgroundCount = 0
  let nonFinanceBackgroundCount = 0
  let refusalBackgroundCount = 0
  let unknownBackgroundCount = 0
  for (const participant of participants) {
    const bg = participant.profile?.financeBackgroundType
    if (!bg) {
      unknownBackgroundCount += 1
    } else if (FINANCE_RELEVANT.has(bg)) {
      financeBackgroundCount += 1
    } else if (NON_FINANCE.has(bg)) {
      nonFinanceBackgroundCount += 1
    } else if (bg === "prefer_not_to_say") {
      refusalBackgroundCount += 1
    } else {
      unknownBackgroundCount += 1
    }
  }

  return {
    participants,
    records: store.records,
    modelCounts: countModelSelections(store.records, config),
    comparativeCounts: countComparativeSelections(store.records, config),
    worstFlagCounts,
    completedCount: participants.filter((participant) => participant.completionStatus === "completed").length,
    financeBackgroundCount,
    nonFinanceBackgroundCount,
    refusalBackgroundCount,
    unknownBackgroundCount,
    funnelStages: computeFunnelStages(participants, store.records),
    attentionItems: computeAttentionItems(participants, store.records, worstFlagCounts, latencyP95, config),
  }
}

export async function buildExportJson(settings?: PlatformSettingsSnapshot): Promise<string> {
  const store = await readStore()
  // Attach a nested legacyProfile block to records whose original profile snapshot
  // still uses the legacy schema; new-shape records get no legacyProfile field. See D9.
  const records = store.records.map((record) => {
    const legacyProfile = extractLegacyProfileSnapshot(record.participantProfile)
    return legacyProfile ? { ...record, legacyProfile } : record
  })
  const participants = store.participants.map((participant) => {
    const legacyProfile = extractLegacyProfileSnapshot(participant.profile)
    return legacyProfile ? { ...participant, legacyProfile } : participant
  })
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      settings,
      participants,
      records,
    },
    null,
    2,
  )
}

export async function buildExportCsv(): Promise<string> {
  const records = await getEvaluationRecords()
  const rows = records.map((record) => {
    // Read the raw stored profile (pre-migration) so we can recover legacy field values
    // for the legacy_* columns. After this line, profile uses the new schema view.
    const rawProfile = record.participantProfile as unknown as Record<string, unknown>
    const legacy = extractLegacyProfileSnapshot(rawProfile)
    const profile = record.participantProfile
    return {
    participant_token: record.participantToken,
    settings_version: record.settingsVersion ?? "",
    settings_snapshot_hash: record.settingsSnapshotHash ?? "",
    age_range: profile.ageRange ?? "",
    gender: profile.gender ?? "",
    education_level: profile.educationLevel ?? "",
    finance_background_type: profile.financeBackgroundType ?? "",
    grade_or_occupation: profile.gradeOrOccupation ?? "",
    finance_work_experience: profile.financeWorkExperience ?? "",
    investment_experience: profile.investmentExperience ?? "",
    finance_familiarity: profile.financeFamiliarity,
    llm_experience: profile.llmExperience,
    has_used_ai_for_finance: profile.hasUsedAiForFinance === true ? "Y" : profile.hasUsedAiForFinance === false ? "N" : "",
    finance_subdomains: (profile.financeSubdomains ?? []).join("|"),
    question_index: record.questionIndex,
    prompt_category: record.promptCategory,
    user_question: record.userQuestion,
    answer_a: record.answers.A,
    answer_b: record.answers.B,
    answer_c: record.answers.C,
    hidden_mapping_a: record.hiddenModelMapping.A,
    hidden_mapping_b: record.hiddenModelMapping.B,
    hidden_mapping_c: record.hiddenModelMapping.C,
    gateway_mapping_a: record.gatewayModelMapping.A,
    gateway_mapping_b: record.gatewayModelMapping.B,
    gateway_mapping_c: record.gatewayModelMapping.C,
    selected_best: record.selectedBest,
    selected_best_model: record.hiddenModelMapping[record.selectedBest],
    selected_best_gateway_model: record.gatewayModelMapping[record.selectedBest],
    selected_worst: record.selectedWorst,
    selected_worst_model: record.hiddenModelMapping[record.selectedWorst],
    selected_worst_gateway_model: record.gatewayModelMapping[record.selectedWorst],
    best_by_correctness_label: record.facetSelections?.correctness ?? "",
    best_by_correctness_model: resolveModel(record, record.facetSelections?.correctness),
    best_by_correctness_gateway_model: resolveGatewayModel(record, record.facetSelections?.correctness),
    best_by_reasoning_label: record.facetSelections?.reasoning ?? "",
    best_by_reasoning_model: resolveModel(record, record.facetSelections?.reasoning),
    best_by_reasoning_gateway_model: resolveGatewayModel(record, record.facetSelections?.reasoning),
    best_by_completeness_label: record.facetSelections?.completeness ?? "",
    best_by_completeness_model: resolveModel(record, record.facetSelections?.completeness),
    best_by_completeness_gateway_model: resolveGatewayModel(record, record.facetSelections?.completeness),
    best_by_readability_label: record.facetSelections?.readability ?? "",
    best_by_readability_model: resolveModel(record, record.facetSelections?.readability),
    best_by_readability_gateway_model: resolveGatewayModel(record, record.facetSelections?.readability),
    best_reason: record.bestReason,
    worst_reason: record.worstReason,
    worst_answer_flags: (record.worstAnswerFlags ?? []).join("|"),
    quality_flags: (record.qualityFlags ?? []).join("|"),
    rating_correctness: record.qualityRatings?.correctness ?? "",
    rating_completeness: record.qualityRatings?.completeness ?? "",
    rating_professionalism: record.qualityRatings?.professionalism ?? "",
    rating_readability: record.qualityRatings?.readability ?? "",
    timestamp: record.timestamp,
    response_latency_ms: record.responseLatencyMs,
    completion_status: record.completionStatus,
    // legacy_* trailing columns: always emitted (header schema is deterministic).
    // New-shape records produce empty cells here; legacy-shape records emit their
    // original values verbatim. See design D9.
    legacy_field_or_work_domain: legacy?.fieldOrWorkDomain ?? "",
    legacy_is_business_or_finance: legacy?.isBusinessOrFinance ?? "",
    legacy_has_taken_finance_course: legacy?.hasTakenFinanceCourse ?? "",
    legacy_finance_llm_usage: legacy?.financeLlmUsage ?? "",
    }
  })

  const headers = Object.keys(
    rows[0] ?? {
      participant_token: "",
      prompt_category: "",
      user_question: "",
    },
  )

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(",")),
  ].join("\n")
}
