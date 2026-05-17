import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import { generateBlindAnswers } from "@/lib/server/gateway-client"
import {
  deletePendingQuestion,
  getEvaluationRecordsByParticipant,
  getPendingQuestionsByParticipant,
  savePendingQuestion,
} from "@/lib/server/evaluation-storage"
import { getActivePlatformSettings, PlatformSettingsError } from "@/lib/server/platform-settings"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"
import { requireEvaluationSession } from "@/lib/server/session"

interface AnswersRequest {
  participantToken?: string
  questionIndex?: number
  promptCategoryId?: string
  userQuestion?: string
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
  const settings = settingsResult
  const config = settings.config

  const activeSession = await requireEvaluationSession(request)
  if (!activeSession) {
    return NextResponse.json({ error: "Invite session is required before generating answers." }, { status: 401 })
  }

  const clientIp = getClientIp(request)
  const ipLimit = checkRateLimit(
    `answers:ip:${clientIp}`,
    config.limits.rateLimit.answerRequestsPerIpPerMinute,
    60 * 1000,
  )
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "模型回答請求過於頻繁，請稍後再試。" }, { status: 429 })
  }

  const sessionLimit = checkRateLimit(
    `answers:session:${activeSession.session.id}`,
    config.limits.rateLimit.answerRequestsPerSessionPerMinute,
    60 * 1000,
  )
  if (!sessionLimit.ok) {
    return NextResponse.json({ error: "本次問卷送出過於頻繁，請稍後再試。" }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as AnswersRequest | null
  const participantToken = activeSession.participant.token
  const questionIndex = Number(body?.questionIndex)
  const userQuestion = body?.userQuestion?.trim() || ""
  const answeredCount = (await getEvaluationRecordsByParticipant(participantToken)).length
  const expectedQuestionIndex = answeredCount + 1
  const category = config.promptCategories[expectedQuestionIndex - 1]

  if (answeredCount >= config.limits.maxQuestionsPerParticipant) {
    return NextResponse.json({ error: "This participant has already completed the maximum number of questions." }, { status: 409 })
  }
  if (!Number.isInteger(questionIndex) || questionIndex !== expectedQuestionIndex) {
    return NextResponse.json({ error: "Invalid question order for this session." }, { status: 409 })
  }
  if (!category || category.id !== body?.promptCategoryId) {
    return NextResponse.json({ error: "Invalid prompt category." }, { status: 400 })
  }
  if (userQuestion.length < config.limits.minQuestionLength) {
    return NextResponse.json(
      { error: `Question must be at least ${config.limits.minQuestionLength} characters.` },
      { status: 400 },
    )
  }
  if (userQuestion.length > config.limits.maxQuestionLength) {
    return NextResponse.json(
      { error: `Question must be at most ${config.limits.maxQuestionLength} characters.` },
      { status: 400 },
    )
  }

  const participant = activeSession.participant
  if (!participant.profile) {
    return NextResponse.json({ error: "Participant profile is required before generating answers." }, { status: 409 })
  }
  const pendingQuestions = await getPendingQuestionsByParticipant(participantToken)
  if (pendingQuestions.some((pending) => pending.questionIndex === questionIndex)) {
    return NextResponse.json({ error: "This question is already pending judgment." }, { status: 409 })
  }

  try {
    const generated = await generateBlindAnswers({
      answerLabels: config.answerLabels,
      modelIds: config.modelIds,
      providerSettings: settings.provider,
      participantToken,
      questionIndex,
      category,
      question: userQuestion,
    })
    const questionId = randomUUID()

    await savePendingQuestion({
      id: questionId,
      participantToken,
      participantProfile: participant.profile,
      questionIndex,
      promptCategory: category.title,
      promptCategoryId: category.id,
      userQuestion,
      answers: generated.answers,
      hiddenModelMapping: generated.hiddenModelMapping,
      gatewayModelMapping: generated.gatewayModelMapping,
      settingsVersion: settings.settingsVersion,
      settingsSnapshotHash: settings.settingsSnapshotHash,
      timestamp: new Date().toISOString(),
      responseLatencyMs: generated.latencyMs,
    })

    return NextResponse.json({
      questionId,
      answers: generated.answers,
      latencyMs: generated.latencyMs,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate model answers." },
      { status: 502 },
    )
  }
}

interface DeleteRequest {
  questionId?: unknown
}

export async function DELETE(request: Request) {
  const activeSession = await requireEvaluationSession(request)
  if (!activeSession) {
    return NextResponse.json({ error: "Invite session is required." }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as DeleteRequest | null
  const questionId = typeof body?.questionId === "string" ? body.questionId.trim() : ""
  if (!questionId) {
    return NextResponse.json({ error: "questionId is required." }, { status: 400 })
  }

  const result = await deletePendingQuestion(questionId, activeSession.participant.token)
  if (result.status === "forbidden") {
    return NextResponse.json(
      { error: "You cannot delete another participant's pending question." },
      { status: 403 },
    )
  }
  return new NextResponse(null, { status: 204 })
}
