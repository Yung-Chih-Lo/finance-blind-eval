import "server-only"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import type { EvaluationSession, ParticipantStatus } from "@/lib/evaluation/types"
import { getParticipantStatus, getSessionByToken, touchSession } from "@/lib/server/evaluation-storage"

export const EVAL_SESSION_COOKIE = "eval_session"
export const EVAL_COMPLETED_COOKIE = "eval_completed"

const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60
const COMPLETED_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

function parseCookie(header: string | null, name: string) {
  if (!header) {
    return ""
  }
  return (
    header
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  )
}

export function setSessionCookie(response: NextResponse, sessionToken: string) {
  response.cookies.set(EVAL_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export function setCompletedCookie(response: NextResponse) {
  response.cookies.set(EVAL_COMPLETED_COOKIE, "1", {
    httpOnly: true,
    maxAge: COMPLETED_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export async function getSessionTokenFromRequest(request: Request) {
  return parseCookie(request.headers.get("cookie"), EVAL_SESSION_COOKIE)
}

export async function getSessionTokenFromCookies() {
  return (await cookies()).get(EVAL_SESSION_COOKIE)?.value || ""
}

export async function getEvaluationSession(sessionToken: string): Promise<
  | {
      session: EvaluationSession
      participant: ParticipantStatus
    }
  | undefined
> {
  const session = await getSessionByToken(sessionToken)
  if (!session) {
    return undefined
  }

  const participant = await getParticipantStatus(session.participantToken)
  if (!participant) {
    return undefined
  }

  await touchSession(session.id)
  return { session, participant }
}

export async function requireEvaluationSession(request: Request) {
  const sessionToken = await getSessionTokenFromRequest(request)
  return getEvaluationSession(sessionToken)
}
