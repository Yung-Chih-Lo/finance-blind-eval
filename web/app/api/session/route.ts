import { NextResponse } from "next/server"

import { SEEDED_PARTICIPANTS } from "@/lib/evaluation/config"
import type { ParticipantProfile, ParticipantStatus } from "@/lib/evaluation/types"
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
  profile?: ParticipantProfile
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

  if (body?.profile && !body.profile.gradeOrOccupation.trim()) {
    return NextResponse.json({ error: "Missing grade or occupation." }, { status: 400 })
  }

  const now = new Date().toISOString()
  const existing = await getParticipantStatus(token)
  const profile = body?.profile
    ? {
        ...body.profile,
        token,
        knownName: body.profile.knownName || SEEDED_PARTICIPANTS[token]?.name,
      }
    : existing?.profile

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
