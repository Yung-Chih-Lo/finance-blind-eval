import { NextResponse } from "next/server"

import {
  buildPersistedProfile,
  isCompleteParticipantProfile,
  validateParticipantProfile,
} from "@/lib/evaluation/profile"
import type { ParticipantProfile, ParticipantProfileDraft, ParticipantStatus } from "@/lib/evaluation/types"
import {
  getEvaluationRecordsByParticipant,
  getParticipantStatus,
  getPendingQuestionsByParticipant,
  normalizeToken,
  upsertParticipantStatus,
  upsertParticipantStatusAndClearPending,
} from "@/lib/server/evaluation-storage"
import { requireEvaluationSession } from "@/lib/server/session"

interface SessionRequest {
  token?: string
  profile?: ParticipantProfileDraft
}

// Compare the 5 stratification fields + token of two persisted profiles. A pure
// re-submit of an unchanged profile is an idempotent no-op (the route still calls
// upsertParticipantStatus to refresh updatedAt); only a real change triggers the
// pending-clear path. Cheap explicit comparison beats JSON.stringify (would also
// flag key-order differences) and beats deep-equal libs (one more dep).
function profilesEqual(a: ParticipantProfile | undefined, b: ParticipantProfile | undefined): boolean {
  if (!a || !b) return a === b
  return (
    a.token === b.token &&
    a.ageRange === b.ageRange &&
    a.educationLevel === b.educationLevel &&
    a.mainDomain === b.mainDomain &&
    a.aiUsageFrequency === b.aiUsageFrequency &&
    a.hasUsedAiForFinance === b.hasUsedAiForFinance
  )
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
  const nextProfile = validatedProfile ? buildPersistedProfile(token, validatedProfile) : existing?.profile

  const status: ParticipantStatus = {
    token,
    profile: nextProfile,
    completionStatus: nextProfile ? existing?.completionStatus === "completed" ? "completed" : "in_progress" : "profile_started",
    startedAt: existing?.startedAt || now,
    updatedAt: now,
    completedAt: existing?.completedAt,
  }

  // If the participant's profile is being mutated (vs. an idempotent re-submit of
  // the same shape), any pending question already in the store was generated under
  // the OLD participantProfile snapshot — saving an answer for it would persist a
  // record with stale background-stratification fields. Use the atomic upsert+clear
  // helper to invalidate those pending rows in the same mutex window.
  const profileChanged =
    validatedProfile != null &&
    (!existing?.profile || !profilesEqual(existing.profile, nextProfile))
  const participant = profileChanged
    ? await upsertParticipantStatusAndClearPending(status)
    : await upsertParticipantStatus(status)

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
