import { NextResponse } from "next/server"

import type { AnswerLabel, EvaluationFacetId, EvaluationRecord, FacetSelections, QualityRatings, StudyConfig } from "@/lib/evaluation/types"
import {
  getEvaluationRecordsByParticipant,
  getParticipantStatus,
  getPendingQuestion,
  saveEvaluationRecord,
  upsertParticipantStatus,
} from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"
import { requireEvaluationSession, setCompletedCookie } from "@/lib/server/session"

interface RecordRequest {
  questionId?: string
  selectedBest?: AnswerLabel
  selectedWorst?: AnswerLabel
  facetSelections?: Partial<Record<EvaluationFacetId, AnswerLabel>>
  bestReason?: string
  worstReason?: string
  worstAnswerFlags?: string[]
  qualityFlags?: string[]
  qualityRatings?: QualityRatings
}

function isAnswerLabel(value: unknown): value is AnswerLabel {
  return value === "A" || value === "B" || value === "C"
}

function getFacetSelections(
  value: RecordRequest["facetSelections"],
  config: Pick<StudyConfig, "evaluationFacets">,
): FacetSelections | undefined {
  const selections = {} as FacetSelections
  for (const facet of config.evaluationFacets) {
    const selected = value?.[facet.id]
    if (!isAnswerLabel(selected)) {
      return undefined
    }
    selections[facet.id] = selected
  }
  return selections
}

function settingsErrorResponse(error: unknown) {
  if (error instanceof PlatformSettingsError) {
    return NextResponse.json({ error: error.message, issues: error.issues }, { status: error.status })
  }
  return NextResponse.json({ error: "Platform settings could not be loaded." }, { status: 500 })
}

export async function POST(request: Request) {
  const settingsResult = await getActivePlatformSettings().catch((error) => error)
  if (settingsResult instanceof Error) {
    return settingsErrorResponse(settingsResult)
  }
  const config = settingsResult.config

  const activeSession = await requireEvaluationSession(request)
  if (!activeSession) {
    return NextResponse.json({ error: "Invite session is required before saving records." }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as RecordRequest | null
  const questionId = body?.questionId || ""
  const bestReason = body?.bestReason?.trim() || ""
  const worstReason = body?.worstReason?.trim() || ""
  const facetSelections = getFacetSelections(body?.facetSelections, config)

  if (!questionId) {
    return NextResponse.json({ error: "Missing question id." }, { status: 400 })
  }
  if (!isAnswerLabel(body?.selectedBest) || !isAnswerLabel(body?.selectedWorst)) {
    return NextResponse.json({ error: "Best and worst selections are required." }, { status: 400 })
  }
  if (body.selectedBest === body.selectedWorst) {
    return NextResponse.json({ error: "Best and worst selections must be different." }, { status: 400 })
  }
  if (!facetSelections) {
    return NextResponse.json({ error: "All comparative facet selections are required." }, { status: 400 })
  }
  if (!bestReason && !worstReason) {
    return NextResponse.json({ error: "At least one reason is required." }, { status: 400 })
  }

  const pending = await getPendingQuestion(questionId)
  if (!pending) {
    return NextResponse.json({ error: "Question was not found or has already been recorded." }, { status: 404 })
  }
  if (pending.participantToken !== activeSession.participant.token) {
    return NextResponse.json({ error: "Question does not belong to this session." }, { status: 403 })
  }

  const record: EvaluationRecord = {
    ...pending,
    selectedBest: body.selectedBest,
    selectedWorst: body.selectedWorst,
    facetSelections,
    bestReason,
    worstReason,
    worstAnswerFlags: Array.isArray(body.worstAnswerFlags) ? body.worstAnswerFlags : [],
    qualityFlags: Array.isArray(body.qualityFlags) ? body.qualityFlags : undefined,
    qualityRatings: body.qualityRatings,
    completionStatus: "answered",
  }

  await saveEvaluationRecord(record)
  const answeredCount = (await getEvaluationRecordsByParticipant(pending.participantToken)).length

  const existingParticipant = await getParticipantStatus(pending.participantToken)
  const now = new Date().toISOString()
  // Completion gate: open only when this save brings answered count up to the
  // configured limit. Prior formula used `pending.questionIndex >= promptCategories.length`
  // which could open the gate when a 5th pending question was generated but never
  // saved (e.g., participant abandoned mid-question). Anchored to actual record
  // count so the gate matches the "answered exactly 5 questions" spec scenario.
  const isCompleted = answeredCount >= config.limits.maxQuestionsPerParticipant
  await upsertParticipantStatus({
    token: pending.participantToken,
    profile: pending.participantProfile,
    completionStatus: isCompleted ? "completed" : "in_progress",
    startedAt: existingParticipant?.startedAt || pending.timestamp,
    updatedAt: now,
    completedAt: isCompleted ? now : existingParticipant?.completedAt,
  })

  const response = NextResponse.json({
    ok: true,
    answeredCount,
    completionStatus: isCompleted ? "completed" : "in_progress",
  })
  if (isCompleted) {
    setCompletedCookie(response)
  }
  return response
}
