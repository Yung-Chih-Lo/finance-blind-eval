#!/usr/bin/env node

// Smoke-test the shared-invite-code redeem flow against a running dev server.
// Usage: SHARED_INVITE_CODE=ailab502 npm run dev  (in one terminal)
//        node scripts/verify-invite-flow.mjs [--base-url http://localhost:5174]
//
// Exits non-zero if any expected response is wrong.

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const item = process.argv[index]
  if (!item.startsWith("--")) continue
  const [rawKey, inlineValue] = item.slice(2).split(/=(.*)/s, 2)
  if (inlineValue !== undefined) {
    args.set(rawKey, inlineValue)
    continue
  }
  const peek = process.argv[index + 1]
  if (peek && !peek.startsWith("--")) {
    args.set(rawKey, peek)
    index += 1
  } else {
    args.set(rawKey, "true")
  }
}

const baseUrl = String(args.get("base-url") || "http://localhost:3000").replace(/\/$/, "")
const inviteCode = String(args.get("invite-code") || "ailab502")

let failures = 0

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  PASS  ${label}`)
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`)
    failures += 1
  }
}

async function postRedeem(body, headers = {}) {
  const response = await fetch(`${baseUrl}/api/session/redeem-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  return { status: response.status, payload }
}

console.log(`Verifying ${baseUrl}/api/session/redeem-invite`)

console.log("\n[1] Wrong invite code → 403")
{
  const { status, payload } = await postRedeem({ inviteCode: "wrong-code" })
  check("status is 403", status === 403, `got ${status}`)
  check("response has error message", typeof payload?.error === "string")
}

console.log("\n[2] Malformed body (inviteCode is object) → 400")
{
  const { status } = await postRedeem({ inviteCode: { not: "a string" } })
  check("status is 400", status === 400, `got ${status}`)
}

console.log("\n[3] Correct invite code → 200 + participant token")
{
  const { status, payload } = await postRedeem({ inviteCode })
  check("status is 200", status === 200, `got ${status}`)
  check("participant.token shaped P-XXXXXXXX", /^P-[A-Z0-9]{8}$/.test(payload?.participant?.token ?? ""))
}

console.log("\n[4] Request with eval_completed=1 cookie → 403")
{
  const { status, payload } = await postRedeem(
    { inviteCode },
    { cookie: "eval_completed=1" },
  )
  check("status is 403", status === 403, `got ${status}`)
  check("error mentions 已完成", String(payload?.error || "").includes("已完成"))
}

console.log("")
if (failures === 0) {
  console.log(`All smoke checks passed.`)
  process.exit(0)
} else {
  console.error(`${failures} smoke check(s) failed.`)
  process.exit(1)
}
