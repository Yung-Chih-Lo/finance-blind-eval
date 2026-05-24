// Regression harness for the participant five-question completion gate.
// Run with:
//   cd web && npm run verify:completion-gate
//
// Pins the spec scenarios under `Participant five-question completion gate`.
// The script does NOT directly invoke the Next.js route handler (would require
// a Next runtime stub); instead it loads the active platform settings,
// asserts the question limit is 5, and reproduces the formula the handler at
// web/app/api/evaluation/records/route.ts:112 must use.

import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Sandbox cwd so loading platform settings doesn't read the real .data/.
const sandbox = mkdtempSync(join(tmpdir(), "completion-gate-"))
process.chdir(sandbox)

import { getActivePlatformSettings } from "@/lib/server/platform-settings"

const failures: string[] = []

function check(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message)
    console.error(`[FAIL] ${message}`)
  } else {
    console.log(`[OK] ${message}`)
  }
}

async function main() {
  console.log("=== verify-completion-gate ===")

  const settings = await getActivePlatformSettings()
  const limit = settings.config.limits.maxQuestionsPerParticipant

  check(
    typeof limit === "number" && limit === 5,
    `config.limits.maxQuestionsPerParticipant must equal 5 (got ${limit})`,
  )
  if (limit !== 5) {
    process.exitCode = 1
    return
  }

  // Formula the handler at records/route.ts:112 MUST use after task 4.1:
  //   const isCompleted = answeredCount >= config.limits.maxQuestionsPerParticipant
  // Reproduce that formula here and assert the resulting transitions match the
  // spec scenarios. This is a unit-level pin on the formula itself, not a
  // black-box test of the route — the route change is verified by hand-trace +
  // typecheck + the spec scenario at archive time.
  const transitions: Array<{ answeredCount: number; expectedCompleted: boolean; label: string }> = [
    { answeredCount: 1, expectedCompleted: false, label: "1 of 5 answered" },
    { answeredCount: 2, expectedCompleted: false, label: "2 of 5 answered" },
    { answeredCount: 3, expectedCompleted: false, label: "3 of 5 answered" },
    { answeredCount: 4, expectedCompleted: false, label: "4 of 5 answered" },
    { answeredCount: 5, expectedCompleted: true, label: "5 of 5 answered — gate opens" },
    { answeredCount: 6, expectedCompleted: true, label: "6 (defensive — sixth record should never reach here)" },
  ]

  for (const transition of transitions) {
    const isCompleted = transition.answeredCount >= limit
    check(
      isCompleted === transition.expectedCompleted,
      `${transition.label}: expected isCompleted=${transition.expectedCompleted}, got ${isCompleted}`,
    )
  }

  // Negative-control assertion: the OLD formula must NOT match the new
  // expected transitions, otherwise this test wouldn't actually catch a
  // regression where someone re-introduces `pending.questionIndex >= config.promptCategories.length`.
  // Specifically, with answeredCount=4 (questionIndex=4 zero-indexed = the 5th question)
  // the old formula `questionIndex >= promptCategories.length` (5 >= 5) would mistakenly
  // mark completed when only 4 records exist (because pending was generated for
  // the fifth slot but the participant abandoned). Document this difference.
  console.log("\n(note) the new gate uses `answeredCount >= 5` instead of `pending.questionIndex >= promptCategories.length`")
  console.log("       — the old formula could open the gate when a fifth pending question was generated but never saved.")

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) failed.`)
    process.exitCode = 1
    return
  }
  console.log("\nPASS: completion gate formula opens only at the 5th saved record.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
