import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { EVALUATION_FACETS, MODEL_IDS, WORST_ANSWER_FLAGS } from "@/lib/evaluation/config"
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

export async function getParticipantStatuses(): Promise<ParticipantStatus[]> {
  return (await readStore()).participants
}

export async function getParticipantStatus(token: string): Promise<ParticipantStatus | undefined> {
  const normalizedToken = normalizeToken(token)
  return (await readStore()).participants.find((participant) => participant.token === normalizedToken)
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
  const participants = store.participants
  const worstFlagCounts = countWorstFlags(store.records, config)
  const latencyP95 = computeLatencyP95(store.records)

  // mainDomain drives the three mutually-exclusive KPI buckets. There is no
  // `unknown` bucket because validation rejects null mainDomain at submit time
  // and no legacy compatibility layer can produce profile-without-mainDomain
  // rows (see design D6). The switch's never-fallthrough is a compile-time
  // exhaustiveness check: adding a new arm to the MainDomain union without
  // updating this switch becomes a type error.
  let financeRelatedCount = 0
  let businessNonFinanceCount = 0
  let otherCount = 0
  for (const participant of participants) {
    const domain = participant.profile?.mainDomain
    if (!domain) continue
    switch (domain) {
      case "finance_related":
        financeRelatedCount += 1
        break
      case "business_non_finance":
        businessNonFinanceCount += 1
        break
      case "other":
        otherCount += 1
        break
      default: {
        const exhaustive: never = domain
        void exhaustive
      }
    }
  }

  return {
    participants,
    records: store.records,
    modelCounts: countModelSelections(store.records, config),
    comparativeCounts: countComparativeSelections(store.records, config),
    worstFlagCounts,
    completedCount: participants.filter((participant) => participant.completionStatus === "completed").length,
    financeRelatedCount,
    businessNonFinanceCount,
    otherCount,
    funnelStages: computeFunnelStages(participants, store.records),
    attentionItems: computeAttentionItems(participants, store.records, worstFlagCounts, latencyP95, config),
  }
}

export async function buildExportJson(settings?: PlatformSettingsSnapshot): Promise<string> {
  const store = await readStore()
  // The 5-field profile is the only shape on disk (the legacy compat layer is
  // gone). Records and participants are serialized verbatim.
  const records = store.records.map((record) => ({ ...record }))
  const participants = store.participants.map((participant) => ({ ...participant }))
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

// Canonical CSV header order. Used both for empty-store header generation and to
// drive Object.keys when at least one row exists. Centralizing here prevents the
// header from silently shrinking to 3 columns when records.length === 0.
const CSV_HEADERS = [
  "participant_token",
  "settings_version",
  "settings_snapshot_hash",
  "token",
  "age_range",
  "education_level",
  "main_domain",
  "ai_usage_frequency",
  "has_used_ai_for_finance",
  "question_index",
  "prompt_category",
  "user_question",
  "answer_a",
  "answer_b",
  "answer_c",
  "hidden_mapping_a",
  "hidden_mapping_b",
  "hidden_mapping_c",
  "gateway_mapping_a",
  "gateway_mapping_b",
  "gateway_mapping_c",
  "selected_best",
  "selected_best_model",
  "selected_best_gateway_model",
  "selected_worst",
  "selected_worst_model",
  "selected_worst_gateway_model",
  "best_by_correctness_label",
  "best_by_correctness_model",
  "best_by_correctness_gateway_model",
  "best_by_completeness_label",
  "best_by_completeness_model",
  "best_by_completeness_gateway_model",
  "best_by_readability_label",
  "best_by_readability_model",
  "best_by_readability_gateway_model",
  "best_reason",
  "worst_reason",
  "worst_answer_flags",
  "quality_flags",
  "rating_correctness",
  "rating_completeness",
  "rating_professionalism",
  "rating_readability",
  "timestamp",
  "response_latency_ms",
  "completion_status",
] as const

export async function buildExportCsv(): Promise<string> {
  const records = await getEvaluationRecords()
  const rows = records.map((record) => {
    const profile = record.participantProfile
    return {
    participant_token: record.participantToken,
    settings_version: record.settingsVersion ?? "",
    settings_snapshot_hash: record.settingsSnapshotHash ?? "",
    token: profile.token,
    age_range: profile.ageRange,
    education_level: profile.educationLevel,
    main_domain: profile.mainDomain,
    ai_usage_frequency: profile.aiUsageFrequency,
    has_used_ai_for_finance: profile.hasUsedAiForFinance === true ? "Y" : profile.hasUsedAiForFinance === false ? "N" : "",
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
    }
  })

  // Use the centralized CSV_HEADERS so the header is stable regardless of row
  // count (empty store still emits the full header).
  return [
    CSV_HEADERS.join(","),
    ...rows.map((row) => CSV_HEADERS.map((header) => csvEscape(row[header as keyof typeof row])).join(",")),
  ].join("\n")
}
