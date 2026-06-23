import { NextResponse } from "next/server"

import { normalizeAnswerScores } from "@/lib/evaluation/answer-scores"
import type { AnswerLabel, AnswerScores, EvaluationRecord } from "@/lib/evaluation/types"
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
  answerScores?: AnswerScores
  bestReason?: string
  worstReason?: string
  worstAnswerFlags?: string[]
  worstOtherText?: string
}

function isAnswerLabel(value: unknown): value is AnswerLabel {
  return value === "A" || value === "B" || value === "C"
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
  const answerScores = normalizeAnswerScores(body?.answerScores, config)

  if (!questionId) {
    return NextResponse.json({ error: "Missing question id." }, { status: 400 })
  }
  if (!isAnswerLabel(body?.selectedBest) || !isAnswerLabel(body?.selectedWorst)) {
    return NextResponse.json({ error: "Best and worst selections are required." }, { status: 400 })
  }
  if (body.selectedBest === body.selectedWorst) {
    return NextResponse.json({ error: "Best and worst selections must be different." }, { status: 400 })
  }
  if (!answerScores) {
    return NextResponse.json({ error: "All answer scores are required and must be integers from 1 to 5." }, { status: 400 })
  }
  if (!bestReason && !worstReason) {
    return NextResponse.json({ error: "At least one reason is required." }, { status: 400 })
  }
  // Mirror the client-side gate in question-flow.saveJudgment: if the participant
  // ticks the "其他" worst-answer flag, the free-text supplement must be present.
  // The client also enforces this, but a hand-crafted request would otherwise
  // bypass the requirement and leave an empty "其他" row in the export.
  const worstAnswerFlags = Array.isArray(body.worstAnswerFlags) ? body.worstAnswerFlags : []
  const worstOtherText = typeof body.worstOtherText === "string" ? body.worstOtherText.trim() : ""
  if (worstAnswerFlags.includes("other") && !worstOtherText) {
    return NextResponse.json({ error: "worstOtherText is required when 'other' flag is selected." }, { status: 400 })
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
    answerScores,
    bestReason,
    worstReason,
    worstAnswerFlags,
    // Persist worstOtherText only when "其他" is actually selected — even though
    // the type allows the field to be optional, storing empty strings under flags
    // that don't include "other" would pollute downstream analysis.
    worstOtherText: worstAnswerFlags.includes("other") ? worstOtherText : undefined,
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
