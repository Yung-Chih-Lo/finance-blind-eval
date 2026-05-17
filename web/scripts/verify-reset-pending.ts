// Regression harness for the reset-pending storage helper.
// Not part of CI. Run with:
//   npm run verify:reset-pending
//
// Chdir's into an OS tmp dir so we never clobber the real .data/ in the repo.

import { strict as assert } from "node:assert"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const sandbox = mkdtempSync(join(tmpdir(), "reset-pending-"))
process.chdir(sandbox)

import {
  deletePendingQuestion,
  getPendingQuestionsByParticipant,
  resetEvaluationData,
  savePendingQuestion,
} from "@/lib/server/evaluation-storage"
import type { PendingQuestion } from "@/lib/evaluation/types"

const OWNER = "P-OWNER"

function makePending(overrides: Partial<PendingQuestion> & Pick<PendingQuestion, "id" | "participantToken">): PendingQuestion {
  return {
    questionIndex: 1,
    promptCategory: "category",
    promptCategoryId: "cat-1",
    userQuestion: "Q?",
    answers: { A: "a", B: "b", C: "c" },
    hiddenModelMapping: { A: "H1-best", B: "H2-best", C: "TAIDE-baseline" },
    gatewayModelMapping: { A: "g-a", B: "g-b", C: "g-c" },
    participantProfile: {
      token: overrides.participantToken,
      isBusinessOrFinance: "no",
      gradeOrOccupation: "grad",
      hasTakenFinanceCourse: "no",
      financeFamiliarity: 1,
      llmExperience: "weekly",
      notes: "",
    },
    timestamp: new Date().toISOString(),
    responseLatencyMs: 100,
    ...overrides,
  }
}

async function main() {
  await resetEvaluationData()

  console.log("\n=== 1.1 deleted: owner removes own pending row ===")
  await savePendingQuestion(makePending({ id: "q-1", participantToken: OWNER }))
  {
    const before = await getPendingQuestionsByParticipant(OWNER)
    assert.equal(before.length, 1, "seed should leave one pending row for OWNER")
  }
  const deleted = await deletePendingQuestion("q-1", OWNER)
  assert.deepEqual(deleted, { status: "deleted" }, "delete result for owner should be 'deleted'")
  {
    const after = await getPendingQuestionsByParticipant(OWNER)
    assert.equal(after.length, 0, "OWNER's pending row should be removed")
  }
  console.log("PASS: deleted path")

  console.log("\nAll reset-pending checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
