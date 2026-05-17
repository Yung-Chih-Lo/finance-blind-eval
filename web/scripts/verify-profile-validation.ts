// Regression harness for the participant profile schema migration.
// Run with:
//   cd web && npm run verify:profile
//
// Chdir's into an OS tmp dir so we never clobber the real .data/ in the repo.

import { strict as assert } from "node:assert"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const sandbox = mkdtempSync(join(tmpdir(), "profile-validation-"))
process.chdir(sandbox)

import {
  createParticipantProfileDraft,
  extractLegacyProfileSnapshot,
  isCompleteParticipantProfile,
  migrateLegacyProfile,
  validateParticipantProfile,
} from "@/lib/evaluation/profile"
import {
  buildExportJson,
  clearPendingQuestionsForParticipant,
  getParticipantStatus,
  getPendingQuestionsByParticipant,
  resetEvaluationData,
  saveEvaluationRecord,
  savePendingQuestion,
  upsertParticipantStatus,
  upsertParticipantStatusAndClearPending,
} from "@/lib/server/evaluation-storage"
import type { EvaluationRecord, ParticipantProfile, ParticipantProfileDraft, PendingQuestion } from "@/lib/evaluation/types"

function buildLegacyProfile(token: string): ParticipantProfile {
  // Real legacy records on disk have fields the new ParticipantProfile type rejects.
  // We force the type with `as unknown as ParticipantProfile` to mirror what arrives
  // from storage before migration.
  return {
    token,
    ageRange: "25_29",
    fieldOrWorkDomain: "資管系",
    isBusinessOrFinance: "yes",
    gradeOrOccupation: "碩二",
    hasTakenFinanceCourse: "yes",
    financeWorkExperience: "internship",
    investmentExperience: "basic",
    financeFamiliarity: 4,
    llmExperience: "weekly",
    financeLlmUsage: "weekly",
    financeSubdomains: ["stocks"],
    notes: "",
  } as unknown as ParticipantProfile
}

function testMigrateLegacyProfile() {
  console.log("\n=== migrateLegacyProfile ===")
  const legacy = {
    ageRange: "25_29",
    fieldOrWorkDomain: "資管系",
    isBusinessOrFinance: "yes",
    hasTakenFinanceCourse: "yes",
    financeLlmUsage: "weekly",
    financeFamiliarity: 4,
    financeWorkExperience: "internship",
    investmentExperience: "basic",
    llmExperience: "weekly",
    financeSubdomains: ["stocks", "derivatives", "risk_management"],
    notes: "hello",
    gradeOrOccupation: "碩二",
  }
  const result = migrateLegacyProfile(legacy)

  // (i) compatible fields preserved
  assert.equal(result.ageRange, "25_29", "ageRange preserved")
  assert.equal(result.financeFamiliarity, 4, "financeFamiliarity preserved")
  assert.equal(result.financeWorkExperience, "internship")
  assert.equal(result.investmentExperience, "basic")
  assert.equal(result.llmExperience, "weekly")
  assert.deepEqual(result.financeSubdomains, ["stocks"], "dropped subdomains derivatives/risk_management")
  assert.equal(result.notes, "hello")
  assert.equal(result.gradeOrOccupation, "碩二")

  // (ii) legacy keys dropped
  const resultObj = result as Record<string, unknown>
  for (const legacyKey of ["fieldOrWorkDomain", "isBusinessOrFinance", "hasTakenFinanceCourse", "financeLlmUsage"]) {
    assert.ok(!(legacyKey in resultObj), `legacy key ${legacyKey} must be stripped`)
  }

  // (iii) new required keys absent — forces form re-prompt
  for (const newKey of ["gender", "educationLevel", "financeBackgroundType", "hasUsedAiForFinance"]) {
    assert.ok(!(newKey in resultObj), `new required key ${newKey} must NOT be defaulted by migrate`)
  }

  // under_20 remap
  const remapped = migrateLegacyProfile({ ageRange: "under_20", financeSubdomains: [] })
  assert.equal(remapped.ageRange, "prefer_not_to_say", "under_20 → prefer_not_to_say")
  console.log("PASS: migrate strips legacy, preserves compatible, omits new, remaps under_20")
}

function testValidate() {
  console.log("\n=== validateParticipantProfile ===")
  const completeDraft: ParticipantProfileDraft = {
    token: "P-T",
    ageRange: "25_29",
    gender: "female",
    educationLevel: "undergrad_in_progress",
    financeBackgroundType: "student_finance_related",
    financeWorkExperience: "internship",
    investmentExperience: "basic",
    financeFamiliarity: 4,
    llmExperience: "weekly",
    hasUsedAiForFinance: true,
    financeSubdomains: ["stocks"],
    notes: "",
  }
  assert.deepEqual(validateParticipantProfile(completeDraft), [], "complete draft must validate clean")
  assert.equal(isCompleteParticipantProfile(completeDraft), true)

  type WithLoosened<K extends keyof ParticipantProfileDraft> = Omit<ParticipantProfileDraft, K> & Record<K, unknown>

  const noGender = { ...completeDraft, gender: undefined } as WithLoosened<"gender">
  assert.ok(
    validateParticipantProfile(noGender as Partial<ParticipantProfileDraft>).some((i) => i.includes("性別")),
    "missing gender must produce an issue mentioning 性別",
  )

  const noEdu = { ...completeDraft, educationLevel: undefined } as WithLoosened<"educationLevel">
  assert.ok(
    validateParticipantProfile(noEdu as Partial<ParticipantProfileDraft>).some((i) => i.includes("學歷")),
    "missing educationLevel must produce an issue mentioning 學歷",
  )

  const noBg = { ...completeDraft, financeBackgroundType: undefined } as WithLoosened<"financeBackgroundType">
  assert.ok(
    validateParticipantProfile(noBg as Partial<ParticipantProfileDraft>).some((i) => i.includes("金融背景類型")),
    "missing financeBackgroundType must produce an issue mentioning 金融背景類型",
  )

  // The critical Codex F1 case: null must NOT be silently treated as false.
  const nullAi: ParticipantProfileDraft = { ...completeDraft, hasUsedAiForFinance: null }
  const issuesNullAi = validateParticipantProfile(nullAi)
  assert.ok(
    issuesNullAi.some((i) => i.includes("是否曾用 AI 處理金融")),
    `null hasUsedAiForFinance must produce explicit-selection issue; got ${JSON.stringify(issuesNullAi)}`,
  )
  assert.equal(isCompleteParticipantProfile(nullAi), false, "null hasUsedAiForFinance must NOT be considered complete")

  // undefined hasUsedAiForFinance follows the same path.
  const undefAi = { ...completeDraft } as Partial<ParticipantProfileDraft>
  delete undefAi.hasUsedAiForFinance
  assert.ok(
    validateParticipantProfile(undefAi).some((i) => i.includes("是否曾用 AI 處理金融")),
    "undefined hasUsedAiForFinance must also produce the explicit-selection issue",
  )

  console.log("PASS: validation rejects missing required fields and null/undefined hasUsedAiForFinance")
}

async function testStorageBackwardCompatRead() {
  console.log("\n=== storage read of legacy profile ===")
  await resetEvaluationData()

  const token = "P-LEGACY"
  await upsertParticipantStatus({
    token,
    profile: buildLegacyProfile(token),
    completionStatus: "profile_started",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const result = await getParticipantStatus(token)
  assert.ok(result?.profile, "participant should be readable")
  const profileObj = result.profile as unknown as Record<string, unknown>

  for (const legacyKey of ["fieldOrWorkDomain", "isBusinessOrFinance", "hasTakenFinanceCourse", "financeLlmUsage"]) {
    assert.ok(!(legacyKey in profileObj), `${legacyKey} must be stripped on read`)
  }
  for (const newKey of ["gender", "educationLevel", "financeBackgroundType", "hasUsedAiForFinance"]) {
    assert.ok(!(newKey in profileObj), `${newKey} must NOT be defaulted on read — form should re-prompt`)
  }
  assert.equal(profileObj.ageRange, "25_29", "compatible ageRange survives migration")

  console.log("PASS: getParticipantStatus migrates legacy profile on read")
}

async function testClearPendingOnLegacyResubmit() {
  console.log("\n=== clearPendingQuestionsForParticipant on legacy resubmit ===")
  await resetEvaluationData()

  const token = "P-MID"
  const legacyProfile = buildLegacyProfile(token)

  await upsertParticipantStatus({
    token,
    profile: legacyProfile,
    completionStatus: "in_progress",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const pending: PendingQuestion = {
    id: "q-legacy-1",
    participantToken: token,
    participantProfile: legacyProfile,
    questionIndex: 1,
    promptCategory: "finance-concept",
    promptCategoryId: "finance-concept",
    userQuestion: "Q?",
    answers: { A: "a", B: "b", C: "c" },
    hiddenModelMapping: { A: "H1-best", B: "H2-best", C: "TAIDE-baseline" },
    gatewayModelMapping: { A: "g-a", B: "g-b", C: "g-c" },
    timestamp: new Date().toISOString(),
    responseLatencyMs: 100,
  }
  await savePendingQuestion(pending)

  const beforeClear = await getPendingQuestionsByParticipant(token)
  assert.equal(beforeClear.length, 1, "seed should leave one pending entry")

  await clearPendingQuestionsForParticipant(token)

  const afterClear = await getPendingQuestionsByParticipant(token)
  assert.equal(afterClear.length, 0, "pending should be empty after clearPendingQuestionsForParticipant")
  console.log("PASS: clearPendingQuestionsForParticipant removes all entries for that token")
}

function testDraftSeedsNullForRequiredEnums() {
  console.log("\n=== createParticipantProfileDraft seeds null for required enums (anti-silent-default) ===")
  const draft = createParticipantProfileDraft("P-FRESH")
  // These five fields used to silently default to prefer_not_to_say / "none"; we now
  // force the participant to explicitly pick.
  assert.equal(draft.gender, null, "gender must start as null")
  assert.equal(draft.educationLevel, null, "educationLevel must start as null")
  assert.equal(draft.financeBackgroundType, null, "financeBackgroundType must start as null")
  assert.equal(draft.financeWorkExperience, null, "financeWorkExperience (primary stratifier) must start as null")
  assert.equal(draft.investmentExperience, null, "investmentExperience must start as null")
  assert.equal(draft.hasUsedAiForFinance, null, "hasUsedAiForFinance must start as null")

  const issues = validateParticipantProfile(draft)
  for (const fragment of ["性別", "學歷", "金融背景類型", "金融工作", "投資經驗", "是否曾用 AI 處理金融"]) {
    assert.ok(
      issues.some((i) => i.includes(fragment)),
      `validation must surface an issue containing "${fragment}"; got ${JSON.stringify(issues)}`,
    )
  }
  assert.equal(isCompleteParticipantProfile(draft), false, "untouched draft must not pass completion")
  console.log("PASS: null defaults blocked by validation across all six required pick-one fields")
}

function testExtractLegacyHandlesNonString() {
  console.log("\n=== extractLegacyProfileSnapshot coerces non-string legacy values ===")
  const raw = {
    fieldOrWorkDomain: "資管系",
    isBusinessOrFinance: true,
    hasTakenFinanceCourse: 1,
    financeLlmUsage: "weekly",
  }
  const snapshot = extractLegacyProfileSnapshot(raw)
  assert.ok(snapshot, "snapshot must be defined for mixed-type legacy record")
  assert.equal(snapshot?.fieldOrWorkDomain, "資管系", "string preserved")
  assert.equal(snapshot?.isBusinessOrFinance, "true", "boolean coerced to string")
  assert.equal(snapshot?.hasTakenFinanceCourse, "1", "number coerced to string")
  assert.equal(snapshot?.financeLlmUsage, "weekly", "string preserved")

  const emptyOnly = extractLegacyProfileSnapshot({ fieldOrWorkDomain: "", isBusinessOrFinance: null })
  assert.equal(emptyOnly, undefined, "all-empty-or-null inputs return undefined")
  console.log("PASS: non-string legacy values preserved via String() coercion")
}

async function testJsonExportMigratesAndAttachesLegacy() {
  console.log("\n=== buildExportJson strips legacy keys from active profile + attaches legacyProfile ===")
  await resetEvaluationData()

  const token = "P-LEGACY-RECORD"
  const legacyProfile = buildLegacyProfile(token)
  await upsertParticipantStatus({
    token,
    profile: legacyProfile,
    completionStatus: "completed",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  })

  const record: EvaluationRecord = {
    id: "q-legacy-export",
    participantToken: token,
    participantProfile: legacyProfile,
    questionIndex: 1,
    promptCategory: "finance-concept",
    promptCategoryId: "finance-concept",
    userQuestion: "Q?",
    answers: { A: "a", B: "b", C: "c" },
    hiddenModelMapping: { A: "H1-best", B: "H2-best", C: "TAIDE-baseline" },
    gatewayModelMapping: { A: "g-a", B: "g-b", C: "g-c" },
    timestamp: new Date().toISOString(),
    responseLatencyMs: 100,
    selectedBest: "A",
    selectedWorst: "C",
    bestReason: "best",
    worstReason: "worst",
    completionStatus: "answered",
  }
  await saveEvaluationRecord(record)

  const json = await buildExportJson()
  const parsed = JSON.parse(json) as {
    records: Array<Record<string, unknown>>
    participants: Array<Record<string, unknown>>
  }
  const exportedRecord = parsed.records.find((r) => r.id === record.id)
  assert.ok(exportedRecord, "legacy record must appear in export")
  const exportedRecordProfile = exportedRecord.participantProfile as Record<string, unknown>
  for (const legacyKey of ["fieldOrWorkDomain", "isBusinessOrFinance", "hasTakenFinanceCourse", "financeLlmUsage"]) {
    assert.ok(
      !(legacyKey in exportedRecordProfile),
      `record.participantProfile must NOT contain ${legacyKey} after JSON export migration`,
    )
  }
  const legacyBlock = exportedRecord.legacyProfile as Record<string, unknown> | undefined
  assert.ok(legacyBlock, "legacyProfile block must exist on legacy record")
  assert.equal(legacyBlock?.fieldOrWorkDomain, "資管系")
  assert.equal(legacyBlock?.isBusinessOrFinance, "yes")

  const exportedParticipant = parsed.participants.find((p) => p.token === token)
  assert.ok(exportedParticipant, "legacy participant must appear in export")
  const participantProfile = exportedParticipant.profile as Record<string, unknown>
  for (const legacyKey of ["fieldOrWorkDomain", "isBusinessOrFinance", "hasTakenFinanceCourse", "financeLlmUsage"]) {
    assert.ok(!(legacyKey in participantProfile), `participant.profile must NOT contain ${legacyKey} after JSON export migration`)
  }
  assert.ok(exportedParticipant.legacyProfile, "participant must have legacyProfile block")
  console.log("PASS: JSON export migrates active profile and attaches legacyProfile only for legacy records")
}

async function testCombinedUpsertClearsPending() {
  console.log("\n=== upsertParticipantStatusAndClearPending atomic combined helper ===")
  await resetEvaluationData()

  const token = "P-ATOMIC"
  const legacyProfile = buildLegacyProfile(token)
  await upsertParticipantStatus({
    token,
    profile: legacyProfile,
    completionStatus: "in_progress",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await savePendingQuestion({
    id: "q-atomic-1",
    participantToken: token,
    participantProfile: legacyProfile,
    questionIndex: 1,
    promptCategory: "finance-concept",
    promptCategoryId: "finance-concept",
    userQuestion: "Q?",
    answers: { A: "a", B: "b", C: "c" },
    hiddenModelMapping: { A: "H1-best", B: "H2-best", C: "TAIDE-baseline" },
    gatewayModelMapping: { A: "g-a", B: "g-b", C: "g-c" },
    timestamp: new Date().toISOString(),
    responseLatencyMs: 100,
  })

  const newProfile: ParticipantProfile = {
    token,
    ageRange: "25_29",
    gender: "female",
    educationLevel: "undergrad_completed",
    financeBackgroundType: "working_finance_related",
    financeWorkExperience: "professional",
    investmentExperience: "advanced",
    financeFamiliarity: 5,
    llmExperience: "daily",
    hasUsedAiForFinance: true,
    financeSubdomains: ["stocks"],
    notes: "",
  }

  await upsertParticipantStatusAndClearPending({
    token,
    profile: newProfile,
    completionStatus: "in_progress",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const pending = await getPendingQuestionsByParticipant(token)
  assert.equal(pending.length, 0, "pending must be empty after atomic upsert+clear")
  const status = await getParticipantStatus(token)
  assert.equal(status?.profile?.financeBackgroundType, "working_finance_related", "new profile must be persisted")
  console.log("PASS: combined helper writes profile and clears pending in one mutex window")
}

async function main() {
  testMigrateLegacyProfile()
  testValidate()
  testDraftSeedsNullForRequiredEnums()
  testExtractLegacyHandlesNonString()
  await testStorageBackwardCompatRead()
  await testClearPendingOnLegacyResubmit()
  await testJsonExportMigratesAndAttachesLegacy()
  await testCombinedUpsertClearsPending()
  console.log("\nOK")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
