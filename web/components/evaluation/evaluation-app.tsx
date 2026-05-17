"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { CompletionPage } from "@/components/evaluation/completion-page"
import { ProfileForm } from "@/components/evaluation/profile-form"
import { QuestionFlow } from "@/components/evaluation/question-flow"
import { TokenEntry } from "@/components/evaluation/token-entry"
import type { AnswerLabel, ParticipantProfile, ParticipantStatus, StudyConfig } from "@/lib/evaluation/types"

type ParticipantStep = "entry" | "profile" | "question" | "done"

interface PublicPendingQuestion {
  questionId: string
  answers: Record<AnswerLabel, string>
  latencyMs: number
  questionIndex: number
  promptCategoryId: string
  userQuestion: string
}

function normalizeToken(value: string) {
  return value.trim().toUpperCase()
}

interface EvaluationAppProps {
  config: StudyConfig
  initialInviteCode?: string
}

export function EvaluationApp({ config, initialInviteCode = "" }: EvaluationAppProps) {
  const router = useRouter()
  const normalizedInitialInviteCode = normalizeToken(initialInviteCode)
  const maxQuestionsPerParticipant = config.limits.maxQuestionsPerParticipant
  const [token, setToken] = useState("")
  const [profile, setProfile] = useState<ParticipantProfile | null>(null)
  const [step, setStep] = useState<ParticipantStep>("entry")
  const [answeredCount, setAnsweredCount] = useState(0)
  const [pendingQuestion, setPendingQuestion] = useState<PublicPendingQuestion | null>(null)

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 2500)

    async function loadSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store", signal: controller.signal })
        if (!response.ok) {
          return
        }
        const data = (await response.json()) as {
          participant?: ParticipantStatus | null
          answeredCount?: number
          pendingQuestion?: PublicPendingQuestion | null
        }
        if (!isMounted || !data.participant) {
          return
        }
        setToken(data.participant.token)
        setProfile(data.participant.profile ?? null)
        setAnsweredCount(data.answeredCount ?? 0)
        setPendingQuestion(data.pendingQuestion ?? null)
        if (
          data.participant.completionStatus === "completed" ||
          (data.answeredCount ?? 0) >= maxQuestionsPerParticipant
        ) {
          setStep("done")
        } else {
          setStep(data.participant.profile ? "question" : "profile")
        }
        router.replace("/")
      } catch {
        // A missing, expired, or temporarily unreachable session is expected
        // for first-time participants — fall through to the invite-code entry
        // step rather than blocking on the GET /api/session round-trip.
      }
    }

    void loadSession()
    return () => {
      isMounted = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [maxQuestionsPerParticipant, router])

  if (step === "entry") {
    return (
      <TokenEntry
        config={config}
        initialInviteCode={normalizedInitialInviteCode}
        onStart={(participant, nextAnsweredCount) => {
          setToken(participant.token)
          setProfile(participant.profile ?? null)
          setAnsweredCount(nextAnsweredCount)
          setPendingQuestion(null)
          router.replace("/")
          setStep(participant.profile ? "question" : "profile")
        }}
      />
    )
  }

  if (step === "profile" || !profile) {
    return (
      <ProfileForm
        token={token}
        onSubmit={(nextProfile) => {
          setProfile(nextProfile)
          setAnsweredCount(0)
          setPendingQuestion(null)
          setStep("question")
        }}
      />
    )
  }

  if (step === "done") {
    return <CompletionPage config={config} />
  }

  return (
    <QuestionFlow
      config={config}
      token={token}
      profile={profile}
      initialQuestionIndex={pendingQuestion ? pendingQuestion.questionIndex - 1 : answeredCount}
      initialQuestion={pendingQuestion?.userQuestion ?? ""}
      initialAnswerResponse={
        pendingQuestion
          ? {
              questionId: pendingQuestion.questionId,
              answers: pendingQuestion.answers,
              latencyMs: pendingQuestion.latencyMs,
            }
          : null
      }
      onAnswerSaved={(nextAnsweredCount) => {
        setAnsweredCount(nextAnsweredCount)
        setPendingQuestion(null)
      }}
      onComplete={() => setStep("done")}
    />
  )
}
