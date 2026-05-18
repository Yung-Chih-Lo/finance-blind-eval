import { NextResponse } from "next/server"

import { SEEDED_PARTICIPANTS } from "@/lib/evaluation/config"
import { isCompleteParticipantProfile, validateParticipantProfile } from "@/lib/evaluation/profile"
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

function buildPersistedProfile(
  token: string,
  raw: ParticipantProfile,
  existingKnownName?: string,
): ParticipantProfile {
  // Explicitly project to the new schema so any rogue legacy keys (fieldOrWorkDomain,
  // isBusinessOrFinance, hasTakenFinanceCourse, financeLlmUsage) that an old client
  // might still send are silently dropped before persist (spec scenario 5.4).
  const grade = raw.gradeOrOccupation?.trim()
  return {
    token,
    knownName: raw.knownName || existingKnownName || SEEDED_PARTICIPANTS[token]?.name,
    ageRange: raw.ageRange,
    gender: raw.gender,
    educationLevel: raw.educationLevel,
    financeBackgroundType: raw.financeBackgroundType,
    gradeOrOccupation: grade ? grade : undefined,
    financeWorkExperience: raw.financeWorkExperience,
    investmentExperience: raw.investmentExperience,
    financeFamiliarity: raw.financeFamiliarity,
    llmExperience: raw.llmExperience,
    hasUsedAiForFinance: raw.hasUsedAiForFinance,
    financeSubdomains: raw.financeSubdomains,
    notes: raw.notes?.trim() ?? "",
  }
}

// A pre-write profile counts as "legacy shape" when it lacks any of the new required
// fields — typically because migrateLegacyProfile stripped legacy keys and could not
// infer the new ones. We trigger pending-clear only on this legacy → new transition
// (design D6) so a routine re-submit of the same new-shape profile is a no-op.
function isLegacyShape(profile: ParticipantStatus["profile"]): boolean {
  if (!profile) return false
  return (
    !profile.gender ||
    !profile.educationLevel ||
    !profile.financeBackgroundType ||
    typeof profile.hasUsedAiForFinance !== "boolean"
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
  const wasLegacy = isLegacyShape(existing?.profile)
  const profile = validatedProfile
    ? buildPersistedProfile(token, validatedProfile, existing?.profile?.knownName)
    : existing?.profile

  const status: ParticipantStatus = {
    token,
    profile,
    completionStatus: profile ? existing?.completionStatus === "completed" ? "completed" : "in_progress" : "profile_started",
    startedAt: existing?.startedAt || now,
    updatedAt: now,
    completedAt: existing?.completedAt,
  }

  // Legacy → new-shape transition: pending questions carry a legacy participantProfile
  // snapshot and would otherwise leak into the saved evaluation record, or block
  // regeneration via 409. We run upsert + clear in a SINGLE mutex window (combined
  // helper) so a concurrent answer-generation POST can't insert a fresh pending row
  // between the two writes that the late clear would then nuke.
  const participant =
    validatedProfile && wasLegacy
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
