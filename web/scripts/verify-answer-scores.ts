// Regression harness for the A/B/C x facet answer score schema.
// Run with:
//   cd web && npm run verify:answer-scores

import { strict as assert } from "node:assert"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const sandbox = mkdtempSync(join(tmpdir(), "answer-scores-"))
process.chdir(sandbox)

import { normalizeAnswerScores } from "@/lib/evaluation/answer-scores"
import { DEFAULT_STUDY_CONFIG } from "@/lib/evaluation/config"
import type { AnswerScores, EvaluationRecord, ParticipantProfile } from "@/lib/evaluation/types"
import {
  buildExportCsv,
  buildExportJson,
  calculateModelScoreAverages,
  getAdminSnapshot,
  resetEvaluationData,
  saveEvaluationRecord,
} from "@/lib/server/evaluation-storage"

const profile: ParticipantProfile = {
  token: "P-SCORES",
  ageRange: "25_29",
  educationLevel: "undergrad_in_progress",
  mainDomain: "finance_related",
  aiUsageFrequency: "frequent",
  hasUsedAiForFinance: true,
}

const validScores: AnswerScores = {
  A: { correctness: 5, completeness: 4, readability: 3 },
  B: { correctness: 4, completeness: 3, readability: 2 },
  C: { correctness: 1, completeness: 2, readability: 3 },
}

function buildRecord(answerScores: AnswerScores = validScores): EvaluationRecord {
  return {
    id: "q-answer-scores",
    participantToken: profile.token,
    participantProfile: profile,
    questionIndex: 1,
    promptCategory: "finance-concept",
    promptCategoryId: "finance-concept",
    userQuestion: "為什麼通膨下降不一定代表物價水準正在下降？",
    answers: { A: "answer-a", B: "answer-b", C: "answer-c" },
    hiddenModelMapping: { A: "TAIDE-baseline", B: "H1-best", C: "H2-best" },
    gatewayModelMapping: { A: "gateway-taide", B: "gateway-h1", C: "gateway-h2" },
    timestamp: new Date().toISOString(),
    responseLatencyMs: 100,
    selectedBest: "A",
    selectedWorst: "C",
    answerScores,
    bestReason: "best",
    worstReason: "worst",
    worstAnswerFlags: ["too-vague"],
    completionStatus: "answered",
  }
}

function testScoreNormalization() {
  assert.deepEqual(
    normalizeAnswerScores(validScores, DEFAULT_STUDY_CONFIG),
    validScores,
    "valid full A/B/C score matrix should normalize",
  )

  const missing = structuredClone(validScores) as Record<string, Partial<Record<string, number>>>
  delete missing.A.readability
  assert.equal(
    normalizeAnswerScores(missing, DEFAULT_STUDY_CONFIG),
    undefined,
    "missing score should fail normalization",
  )

  for (const invalid of [0, 6, 2.5, "5"]) {
    const scores = structuredClone(validScores) as Record<string, Record<string, unknown>>
    scores.A.correctness = invalid
    assert.equal(
      normalizeAnswerScores(scores, DEFAULT_STUDY_CONFIG),
      undefined,
      `invalid score ${JSON.stringify(invalid)} should fail normalization`,
    )
  }
}

async function testStorageExportAndAggregation() {
  await resetEvaluationData()
  const record = buildRecord()
  await saveEvaluationRecord(record)

  const parsed = JSON.parse(await buildExportJson()) as { records: Array<Record<string, unknown>> }
  assert.deepEqual(parsed.records[0].answerScores, validScores, "JSON export should include answerScores")
  assert.equal("facetSelections" in parsed.records[0], false, "new JSON records should not include facetSelections")
  assert.equal("qualityRatings" in parsed.records[0], false, "new JSON records should not include qualityRatings")
  assert.equal("qualityFlags" in parsed.records[0], false, "new JSON records should not include qualityFlags")

  const scoreAverages = calculateModelScoreAverages([record], DEFAULT_STUDY_CONFIG)
  assert.deepEqual(scoreAverages["TAIDE-baseline"], {
    correctness: 5,
    completeness: 4,
    readability: 3,
    overall: 4,
    n: 1,
  })
  assert.deepEqual(scoreAverages["H1-best"], {
    correctness: 4,
    completeness: 3,
    readability: 2,
    overall: 3,
    n: 1,
  })
  assert.deepEqual(scoreAverages["H2-best"], {
    correctness: 1,
    completeness: 2,
    readability: 3,
    overall: 2,
    n: 1,
  })

  const snapshot = await getAdminSnapshot(DEFAULT_STUDY_CONFIG)
  assert.deepEqual(snapshot.scoreAverages, scoreAverages, "admin snapshot should expose score averages")

  const csv = await buildExportCsv()
  const header = csv.split("\n")[0].split(",")
  for (const required of [
    "score_a_correctness",
    "score_a_completeness",
    "score_a_readability",
    "score_b_correctness",
    "score_b_completeness",
    "score_b_readability",
    "score_c_correctness",
    "score_c_completeness",
    "score_c_readability",
    "score_model_h1_best_correctness",
    "score_model_h2_best_completeness",
    "score_model_taide_baseline_readability",
  ]) {
    assert.ok(header.includes(required), `CSV header should include ${required}`)
  }
  for (const removed of ["best_by_correctness_label", "best_by_completeness_model", "rating_correctness"]) {
    assert.ok(!header.includes(removed), `CSV header should not include removed column ${removed}`)
  }
}

async function main() {
  testScoreNormalization()
  await testStorageExportAndAggregation()
  console.log("verify-answer-scores: all assertions passed")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
