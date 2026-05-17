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
const OTHER = "P-OTHER"

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

  console.log("\n=== 1.7 not_found: deleting the same row again is a no-op ===")
  const repeat = await deletePendingQuestion("q-1", OWNER)
  assert.deepEqual(repeat, { status: "not_found" }, "repeat delete should be 'not_found'")
  {
    const after = await getPendingQuestionsByParticipant(OWNER)
    assert.equal(after.length, 0, "still zero pending rows after repeat delete")
  }
  console.log("PASS: not_found path")

  console.log("\n=== 1.8 forbidden: non-owner cannot delete another's pending row ===")
  await savePendingQuestion(makePending({ id: "q-2", participantToken: OWNER }))
  const forbidden = await deletePendingQuestion("q-2", OTHER)
  assert.deepEqual(forbidden, { status: "forbidden" }, "non-owner delete should be 'forbidden'")
  {
    const after = await getPendingQuestionsByParticipant(OWNER)
    assert.equal(after.length, 1, "q-2 must still be in storage after forbidden delete")
    assert.equal(after[0].id, "q-2")
  }
  console.log("PASS: forbidden path")

  console.log("\nAll reset-pending checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
