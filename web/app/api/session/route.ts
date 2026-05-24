import { NextResponse } from "next/server"

import { isCompleteParticipantProfile, validateParticipantProfile } from "@/lib/evaluation/profile"
import type { ParticipantProfile, ParticipantProfileDraft, ParticipantStatus } from "@/lib/evaluation/types"
import {
  getEvaluationRecordsByParticipant,
  getParticipantStatus,
  getPendingQuestionsByParticipant,
  normalizeToken,
  upsertParticipantStatus,
} from "@/lib/server/evaluation-storage"
import { requireEvaluationSession } from "@/lib/server/session"

interface SessionRequest {
  token?: string
  profile?: ParticipantProfileDraft
}

function buildPersistedProfile(token: string, raw: ParticipantProfile): ParticipantProfile {
  // Project explicitly to the 6-key shape so any rogue legacy keys (gender,
  // financeBackgroundType, llmExperience, financeFamiliarity, etc.) an old client
  // might still send are silently dropped before persist (see spec scenario
  // "Removed legacy fields are rejected on submit").
  return {
    token,
    ageRange: raw.ageRange,
    educationLevel: raw.educationLevel,
    mainDomain: raw.mainDomain,
    aiUsageFrequency: raw.aiUsageFrequency,
    hasUsedAiForFinance: raw.hasUsedAiForFinance,
  }
}

function publicPendingQuestion(pendingQuestion: Awaited<ReturnType<typeof getPendingQuestionsByParticipant>>[number]) {
  return {
    questionId: pendingQuestion.id,
    answers: pendingQuestion.answers,
    latencyMs: pendingQuestion.responseLatencyMs,
    questionIndex: pendingQuestion.questionIndex,
    promptCategoryId: pendingQuestion.promptCategoryId,
    userQuestion: pendingQuestion.userQuestion,
  }
}

export async function POST(request: Request) {
  const activeSession = await requireEvaluationSession(request)
  if (!activeSession) {
    return NextResponse.json({ error: "Invite session is required." }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as SessionRequest | null
  const token = normalizeToken(activeSession.participant.token)

  if (!token) {
    return NextResponse.json({ error: "Missing participant token." }, { status: 400 })
  }

  // Type predicate narrows body.profile from ParticipantProfileDraft to ParticipantProfile
  // when validation passes. We capture the narrowed value in a typed local so the
  // assignment downstream doesn't need an `as ParticipantProfile` cast.
  let validatedProfile: ParticipantProfile | undefined
  if (body?.profile) {
    if (!isCompleteParticipantProfile(body.profile)) {
      const issues = validateParticipantProfile(body.profile)
      return NextResponse.json({ error: "Incomplete participant profile.", issues }, { status: 400 })
    }
    validatedProfile = body.profile
  }

  const now = new Date().toISOString()
  const existing = await getParticipantStatus(token)
  const profile = validatedProfile ? buildPersistedProfile(token, validatedProfile) : existing?.profile

  const status: ParticipantStatus = {
    token,
    profile,
    completionStatus: profile ? existing?.completionStatus === "completed" ? "completed" : "in_progress" : "profile_started",
    startedAt: existing?.startedAt || now,
    updatedAt: now,
    completedAt: existing?.completedAt,
  }

  const participant = await upsertParticipantStatus(status)

  const answeredCount = (await getEvaluationRecordsByParticipant(participant.token)).length
  const [pendingQuestion] = await getPendingQuestionsByParticipant(participant.token)
  return NextResponse.json({
    participant,
    answeredCount,
    pendingQuestion: pendingQuestion ? publicPendingQuestion(pendingQuestion) : null,
  })
}

export async function GET(request: Request) {
  const activeSession = await requireEvaluationSession(request)
  if (!activeSession) {
    return NextResponse.json({ participant: null, answeredCount: 0 }, { status: 401 })
  }

  const participant = await getParticipantStatus(activeSession.participant.token)
  if (!participant) {
    return NextResponse.json({ participant: null, answeredCount: 0 }, { status: 401 })
  }

  const answeredCount = (await getEvaluationRecordsByParticipant(participant.token)).length
  const [pendingQuestion] = await getPendingQuestionsByParticipant(participant.token)
  return NextResponse.json({
    participant,
    answeredCount,
    pendingQuestion: pendingQuestion ? publicPendingQuestion(pendingQuestion) : null,
  })
}
