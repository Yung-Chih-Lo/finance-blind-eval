// Regression harness for the 5-field participant profile schema (post simplify-participant-profile-to-5-fields).
// Run with:
//   cd web && npm run verify:profile
//
// Every assertion targets the NEW schema. No legacy / migration test functions remain;
// the legacy compatibility layer (migrateLegacyProfile, extractLegacyProfileSnapshot,
// LegacyProfileSnapshot, LEGACY_FIELDS, legacy_* CSV cols, legacyProfile JSON block,
// upsertParticipantStatusAndClearPending, wasLegacy branch) is gone — see the design
// doc for the simplify-participant-profile-to-5-fields change.
//
// Chdir's into an OS tmp dir so we never clobber the real .data/ in the repo.

import { strict as assert } from "node:assert"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const sandbox = mkdtempSync(join(tmpdir(), "profile-validation-"))
process.chdir(sandbox)

import {
  AGE_RANGE_OPTIONS,
  AI_USAGE_FREQUENCY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  MAIN_DOMAIN_OPTIONS,
  buildPersistedProfile,
  createParticipantProfileDraft,
  formatProfileChoice,
  isCompleteParticipantProfile,
  validateParticipantProfile,
} from "@/lib/evaluation/profile"
import {
  buildExportCsv,
  buildExportJson,
  getParticipantStatus,
  getPendingQuestionsByParticipant,
  resetEvaluationData,
  saveEvaluationRecord,
  savePendingQuestion,
  upsertParticipantStatus,
  upsertParticipantStatusAndClearPending,
} from "@/lib/server/evaluation-storage"
import type {
  EvaluationRecord,
  ParticipantProfile,
  ParticipantProfileDraft,
  PendingQuestion,
} from "@/lib/evaluation/types"

// Canonical complete profile for reuse across positive-path tests.
function buildCompleteProfile(token = "P-COMPLETE"): ParticipantProfile {
  return {
    token,
    ageRange: "25_29",
    educationLevel: "undergrad_in_progress",
    mainDomain: "finance_related",
    aiUsageFrequency: "frequent",
    hasUsedAiForFinance: true,
  }
}

function testProfileShapeStrict() {
  console.log("\n=== ParticipantProfile shape is exactly 6 keys ===")
  const profile = buildCompleteProfile("P-SHAPE")
  const keys = Object.keys(profile).sort()
  const expected = [
    "ageRange",
    "aiUsageFrequency",
    "educationLevel",
    "hasUsedAiForFinance",
    "mainDomain",
    "token",
  ]
  assert.deepEqual(
    keys,
    expected,
    `ParticipantProfile must have exactly these 6 keys, got ${JSON.stringify(keys)}`,
  )
  console.log("PASS: ParticipantProfile keys are exactly the 6 expected fields")
}

function testDraftSeedsNullForFiveRequiredFields() {
  console.log("\n=== createParticipantProfileDraft seeds null for 5 required fields ===")
  const draft = createParticipantProfileDraft("P-FRESH")
  assert.equal(draft.token, "P-FRESH", "token must be set from arg")
  assert.equal(draft.ageRange, null, "ageRange must start as null")
  assert.equal(draft.educationLevel, null, "educationLevel must start as null")
  assert.equal(draft.mainDomain, null, "mainDomain must start as null")
  assert.equal(draft.aiUsageFrequency, null, "aiUsageFrequency must start as null")
  assert.equal(draft.hasUsedAiForFinance, null, "hasUsedAiForFinance must start as null")

  const issues = validateParticipantProfile(draft)
  for (const fragment of ["年齡", "學歷", "目前主要領域", "AI 使用頻率", "是否曾用 AI 處理金融"]) {
    assert.ok(
      issues.some((i) => i.includes(fragment)),
      `validation must surface an issue containing "${fragment}"; got ${JSON.stringify(issues)}`,
    )
  }
  assert.equal(
    isCompleteParticipantProfile(draft),
    false,
    "untouched draft must not pass completion",
  )
  console.log("PASS: null defaults blocked by validation across all 5 required pick-one fields")
}

function testNewEnumValuesOnly() {
  console.log("\n=== Option arrays expose only the new enum values ===")
  const ageValues = AGE_RANGE_OPTIONS.map((option) => option.value)
  assert.deepEqual(
    ageValues,
    ["20_24", "25_29", "30_39", "40_plus"],
    `AGE_RANGE_OPTIONS must expose exactly 4 values; got ${JSON.stringify(ageValues)}`,
  )

  const eduValues = EDUCATION_LEVEL_OPTIONS.map((option) => option.value)
  assert.deepEqual(
    eduValues,
    ["undergrad_in_progress", "undergrad_completed", "grad_or_above"],
    `EDUCATION_LEVEL_OPTIONS must expose exactly 3 values; got ${JSON.stringify(eduValues)}`,
  )

  const domainValues = MAIN_DOMAIN_OPTIONS.map((option) => option.value)
  assert.deepEqual(
    domainValues,
    ["finance_related", "business_non_finance"],
    `MAIN_DOMAIN_OPTIONS must expose exactly 2 values; got ${JSON.stringify(domainValues)}`,
  )

  const freqValues = AI_USAGE_FREQUENCY_OPTIONS.map((option) => option.value)
  assert.deepEqual(
    freqValues,
    ["never", "occasional", "frequent", "daily"],
    `AI_USAGE_FREQUENCY_OPTIONS must expose exactly 4 values; got ${JSON.stringify(freqValues)}`,
  )

  // Defense-in-depth: no option in any array carries the removed prefer_not_to_say.
  const allOptionValues = [
    ...ageValues,
    ...eduValues,
    ...domainValues,
    ...freqValues,
  ]
  for (const value of allOptionValues) {
    assert.ok(
      !String(value).includes("prefer_not_to_say"),
      `option value '${value}' must not contain prefer_not_to_say`,
    )
  }
  console.log("PASS: option arrays match the new schema and exclude prefer_not_to_say")
}

function testRejectsOldEnumLiterals() {
  console.log("\n=== validateParticipantProfile rejects removed legacy enum literals ===")
  const base = buildCompleteProfile("P-LEGACY-VALUES") as unknown as ParticipantProfileDraft

  // Old prefer_not_to_say ageRange — removed.
  const oldAge = { ...base, ageRange: "prefer_not_to_say" } as unknown as ParticipantProfileDraft
  assert.ok(
    validateParticipantProfile(oldAge).some((i) => i.includes("年齡")),
    "ageRange=prefer_not_to_say must fail validation",
  )

  // Old high_school_or_below educationLevel — removed by refine-survey-copy-and-facets, still rejected.
  const oldEdu = { ...base, educationLevel: "high_school_or_below" } as unknown as ParticipantProfileDraft
  assert.ok(
    validateParticipantProfile(oldEdu).some((i) => i.includes("學歷")),
    "educationLevel=high_school_or_below must fail validation",
  )

  // Old financeBackgroundType field/value — entire field gone; sneaking it in via the mainDomain
  // slot with a legacy value must fail.
  const oldDomain = { ...base, mainDomain: "student_finance_related" } as unknown as ParticipantProfileDraft
  assert.ok(
    validateParticipantProfile(oldDomain).some((i) => i.includes("目前主要領域")),
    "mainDomain with legacy financeBackgroundType literal must fail validation",
  )

  // Old llmExperience value — 'weekly' is not a member of the new 4-bucket AiUsageFrequency.
  const oldFreq = { ...base, aiUsageFrequency: "weekly" } as unknown as ParticipantProfileDraft
  assert.ok(
    validateParticipantProfile(oldFreq).some((i) => i.includes("AI 使用頻率")),
    "aiUsageFrequency with legacy llmExperience literal must fail validation",
  )
  console.log("PASS: legacy enum literals are rejected across all 4 enum fields")
}

async function testCsvHeaderHasOnlyFiveActiveFields() {
  console.log("\n=== CSV header has the 5 active-profile cols and no legacy / removed cols ===")
  await resetEvaluationData()

  const csv = await buildExportCsv()
  const header = csv.split(/\r?\n/)[0] ?? ""
  const cols = header.split(",")

  const required = [
    "token",
    "age_range",
    "education_level",
    "main_domain",
    "ai_usage_frequency",
    "has_used_ai_for_finance",
  ]
  for (const col of required) {
    assert.ok(
      cols.includes(col),
      `CSV header must contain column '${col}'; got ${JSON.stringify(cols)}`,
    )
  }

  const banned = [
    "gender",
    "grade_or_occupation",
    "finance_work_experience",
    "investment_experience",
    "finance_familiarity",
    "finance_subdomains",
    "notes",
    "known_name",
    "llm_experience",
    "finance_background_type",
    "legacy_field_or_work_domain",
    "legacy_is_business_or_finance",
    "legacy_has_taken_finance_course",
    "legacy_finance_llm_usage",
  ]
  for (const col of banned) {
    assert.ok(
      !cols.includes(col),
      `CSV header must NOT contain '${col}'; full header was ${JSON.stringify(cols)}`,
    )
  }
  console.log("PASS: CSV header carries the 5 new active-profile cols and rejects all 14 removed cols")
}

async function testJsonExportHasNoLegacyBlock() {
  console.log("\n=== JSON export uses single 5-field profile shape, no legacyProfile block ===")
  await resetEvaluationData()

  const token = "P-JSON-EXPORT"
  const profile = buildCompleteProfile(token)
  await upsertParticipantStatus({
    token,
    profile,
    completionStatus: "completed",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  })

  const record: EvaluationRecord = {
    id: "q-json-export",
    participantToken: token,
    participantProfile: profile,
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
    facetSelections: { correctness: "A", completeness: "A", readability: "A" },
    bestReason: "best",
    worstReason: "worst",
    completionStatus: "answered",
  }
  await saveEvaluationRecord(record)

  const parsed = JSON.parse(await buildExportJson()) as {
    records: Array<Record<string, unknown>>
    participants: Array<Record<string, unknown>>
  }

  const expectedKeys = [
    "ageRange",
    "aiUsageFrequency",
    "educationLevel",
    "hasUsedAiForFinance",
    "mainDomain",
    "token",
  ]

  for (const r of parsed.records) {
    assert.ok(!("legacyProfile" in r), "record must NOT have legacyProfile key")
    const profileObj = r.participantProfile as Record<string, unknown>
    assert.deepEqual(
      Object.keys(profileObj).sort(),
      expectedKeys,
      `record.participantProfile keys must be exactly the 5-field set; got ${JSON.stringify(Object.keys(profileObj))}`,
    )
  }

  for (const p of parsed.participants) {
    assert.ok(!("legacyProfile" in p), "participant must NOT have legacyProfile key")
    if (p.profile != null) {
      const profileObj = p.profile as Record<string, unknown>
      assert.deepEqual(
        Object.keys(profileObj).sort(),
        expectedKeys,
        `participant.profile keys must be exactly the 5-field set; got ${JSON.stringify(Object.keys(profileObj))}`,
      )
    }
  }
  console.log("PASS: JSON export carries only the 5-field profile shape with no legacy block")
}

async function testStorageRoundtripPreservesFiveFieldShape() {
  console.log("\n=== storage roundtrip preserves the 5-field profile verbatim ===")
  await resetEvaluationData()

  const token = "P-ROUND"
  const profile = buildCompleteProfile(token)
  await upsertParticipantStatus({
    token,
    profile,
    completionStatus: "in_progress",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const read = await getParticipantStatus(token)
  assert.ok(read?.profile, "participant should be readable after upsert")

  const profileObj = read.profile as unknown as Record<string, unknown>
  assert.deepEqual(
    Object.keys(profileObj).sort(),
    [
      "ageRange",
      "aiUsageFrequency",
      "educationLevel",
      "hasUsedAiForFinance",
      "mainDomain",
      "token",
    ],
    `read profile keys must equal the 5-field set; got ${JSON.stringify(Object.keys(profileObj))}`,
  )
  assert.equal(profileObj.token, token, "token preserved")
  assert.equal(profileObj.ageRange, "25_29", "ageRange preserved")
  assert.equal(profileObj.educationLevel, "undergrad_in_progress", "educationLevel preserved")
  assert.equal(profileObj.mainDomain, "finance_related", "mainDomain preserved")
  assert.equal(profileObj.aiUsageFrequency, "frequent", "aiUsageFrequency preserved")
  assert.equal(profileObj.hasUsedAiForFinance, true, "hasUsedAiForFinance preserved")
  console.log("PASS: storage write/read leaves the 5-field profile unchanged")
}

function testCompleteDraftPassesValidation() {
  console.log("\n=== validateParticipantProfile accepts a complete 5-field draft ===")
  const complete: ParticipantProfileDraft = {
    token: "P-OK",
    ageRange: "30_39",
    educationLevel: "grad_or_above",
    mainDomain: "business_non_finance",
    aiUsageFrequency: "daily",
    hasUsedAiForFinance: false,
  }
  assert.deepEqual(
    validateParticipantProfile(complete),
    [],
    "complete draft must validate clean",
  )
  assert.equal(
    isCompleteParticipantProfile(complete),
    true,
    "isCompleteParticipantProfile must return true for a complete draft",
  )
  console.log("PASS: validation accepts a fully populated new-schema draft")
}

function testBuildPersistedProfileDropsRogueKeys() {
  console.log("\n=== buildPersistedProfile drops rogue legacy keys before persist ===")
  // Simulate an old/malicious client POSTing a profile body that still carries every
  // dropped legacy key. The server-side projection must surface ONLY the 6 current
  // keys; everything else is silently stripped (spec scenario
  // "Removed legacy fields are rejected on submit").
  const rogue = {
    token: "P-OLD-CLIENT",
    ageRange: "25_29",
    educationLevel: "undergrad_completed",
    mainDomain: "finance_related",
    aiUsageFrequency: "frequent",
    hasUsedAiForFinance: true,
    // ↓ legacy / dropped fields the projection must not let through
    gender: "female",
    gradeOrOccupation: "碩二",
    financeWorkExperience: "internship",
    investmentExperience: "basic",
    financeFamiliarity: 4,
    financeSubdomains: ["stocks"],
    notes: "rogue",
    knownName: "Alice",
    llmExperience: "weekly",
    financeBackgroundType: "student_finance_related",
    fieldOrWorkDomain: "資管系",
    isBusinessOrFinance: "yes",
    hasTakenFinanceCourse: "yes",
    financeLlmUsage: "weekly",
  } as unknown as ParticipantProfile

  const projected = buildPersistedProfile("P-SERVER-TOKEN", rogue)
  const keys = Object.keys(projected).sort()
  assert.deepEqual(
    keys,
    [
      "ageRange",
      "aiUsageFrequency",
      "educationLevel",
      "hasUsedAiForFinance",
      "mainDomain",
      "token",
    ],
    `projection must surface exactly the 6 current keys; got ${JSON.stringify(keys)}`,
  )
  assert.equal(projected.token, "P-SERVER-TOKEN", "projection uses the server-issued token, not the client's")
  console.log("PASS: buildPersistedProfile strips 14 rogue keys and binds server token")
}

function testValidationRejectsMissingToken() {
  console.log("\n=== validateParticipantProfile rejects missing / empty token ===")
  // The type predicate narrowing to ParticipantProfile depends on token being a
  // non-empty string — earlier the validator skipped this check and the predicate
  // lied to the type system on token-less drafts.
  const baseDraft: ParticipantProfileDraft = {
    token: "P-OK",
    ageRange: "20_24",
    educationLevel: "undergrad_in_progress",
    mainDomain: "business_non_finance",
    aiUsageFrequency: "never",
    hasUsedAiForFinance: false,
  }

  for (const badToken of ["", "   "]) {
    const issues = validateParticipantProfile({ ...baseDraft, token: badToken })
    assert.ok(
      issues.some((i) => i.includes("token")),
      `token=${JSON.stringify(badToken)} must produce a token-mentioning issue; got ${JSON.stringify(issues)}`,
    )
  }

  const noTokenDraft = { ...baseDraft } as Partial<ParticipantProfileDraft>
  delete noTokenDraft.token
  assert.ok(
    validateParticipantProfile(noTokenDraft).some((i) => i.includes("token")),
    "missing token must produce a token-mentioning issue",
  )
  assert.equal(
    isCompleteParticipantProfile(noTokenDraft),
    false,
    "draft without token must NOT be considered complete",
  )
  console.log("PASS: empty / missing token rejected by validation across draft variants")
}

function testFormatProfileChoiceNeverLeaksRawEnum() {
  console.log("\n=== formatProfileChoice falls back to '-' for unknown legacy literal ===")
  // A row carrying a removed legacy enum literal (e.g. an admin replaying old data,
  // or a future regression that re-introduces a stale value) must NOT surface the
  // raw token string in the admin UI — that would expose internal enum names to
  // researchers. Always coerce to "-".
  // Cast through `never` because the legacy literal is not a member of MainDomain;
  // we want to exercise the runtime fallback path exactly as a stale on-disk row would.
  const rendered = formatProfileChoice(MAIN_DOMAIN_OPTIONS, "student_finance_related" as never)
  assert.equal(
    rendered,
    "-",
    `unknown enum literal must render as '-'; got ${JSON.stringify(rendered)}`,
  )
  assert.equal(
    formatProfileChoice(MAIN_DOMAIN_OPTIONS, undefined),
    "-",
    "undefined must render as '-'",
  )
  // Sanity: a real current value still renders its label
  assert.equal(
    formatProfileChoice(MAIN_DOMAIN_OPTIONS, "finance_related"),
    "財經類學系或工作（金融/財管/經濟/會計/保險）",
    "current enum literal must still render its label",
  )
  console.log("PASS: formatProfileChoice coerces unknown values to '-' and renders current labels")
}

async function testAtomicUpsertClearsStalePending() {
  console.log("\n=== upsertParticipantStatusAndClearPending atomically invalidates stale pending rows ===")
  // Scenario CodeRabbit flagged on PR #8: participant submits profile A → answer
  // generation creates a pending question carrying profile A as its snapshot →
  // participant resubmits a different profile (B). Without atomic clear, the
  // pending row still carries A, and saving an answer would persist a record under
  // the stale profile, contaminating background-stratification analysis.
  await resetEvaluationData()

  const token = "P-RESUBMIT"
  const profileA: ParticipantProfile = {
    token,
    ageRange: "20_24",
    educationLevel: "undergrad_in_progress",
    mainDomain: "business_non_finance",
    aiUsageFrequency: "never",
    hasUsedAiForFinance: false,
  }
  await upsertParticipantStatus({
    token,
    profile: profileA,
    completionStatus: "in_progress",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const stalePending: PendingQuestion = {
    id: "q-stale",
    participantToken: token,
    participantProfile: profileA,
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
  await savePendingQuestion(stalePending)
  assert.equal(
    (await getPendingQuestionsByParticipant(token)).length,
    1,
    "fixture should seed exactly one pending row before the resubmit",
  )

  const profileB: ParticipantProfile = {
    ...profileA,
    mainDomain: "finance_related",
    aiUsageFrequency: "daily",
    hasUsedAiForFinance: true,
  }
  await upsertParticipantStatusAndClearPending({
    token,
    profile: profileB,
    completionStatus: "in_progress",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const pendingAfter = await getPendingQuestionsByParticipant(token)
  assert.equal(
    pendingAfter.length,
    0,
    `pending must be empty after atomic upsert+clear; got ${pendingAfter.length}`,
  )

  const status = await getParticipantStatus(token)
  assert.equal(status?.profile?.mainDomain, "finance_related", "new profile must be persisted")
  assert.equal(status?.profile?.aiUsageFrequency, "daily", "new profile fields persisted")
  console.log("PASS: atomic helper drops stale pending rows in the same mutex window as profile upsert")
}

async function testJsonExportDoesNotLeakActiveSettings() {
  console.log("\n=== buildExportJson projects settings to PlatformSettingsSnapshot fields only ===")
  // CodeRabbit caught the admin export route handing the full ActivePlatformSettings
  // object (which extends PlatformSettingsSnapshot with `path` / `envelope` /
  // `provider` / `providerStatus`) into buildExportJson. TypeScript's structural
  // typing widens silently; runtime JSON.stringify serializes whatever is there.
  // This test passes the full object as `unknown` and asserts only the 5 snapshot
  // fields survive into the exported JSON.
  await resetEvaluationData()

  const leakyFullSettings = {
    source: "runtime",
    settingsVersion: 3,
    settingsSnapshotHash: "abc123",
    updatedAt: new Date().toISOString(),
    updatedBy: "admin",
    // ↓ extra fields from ActivePlatformSettings that must NOT leak
    path: "/src/.data/platform-settings.json",
    envelope: { someInternal: "stuff" },
    config: { neverEmit: true },
    provider: { apiKeyEnvVar: "OPENAI_COMPAT_API_KEY", systemPrompt: "secret" },
    providerStatus: { apiKeyConfigured: true },
  } as unknown as Parameters<typeof buildExportJson>[0]

  const json = await buildExportJson(leakyFullSettings)
  const parsed = JSON.parse(json) as { settings?: Record<string, unknown> }

  assert.ok(parsed.settings, "settings block must be emitted")
  const settingsKeys = Object.keys(parsed.settings).sort()
  assert.deepEqual(
    settingsKeys,
    ["settingsSnapshotHash", "settingsVersion", "source", "updatedAt", "updatedBy"],
    `exported settings must contain only the 5 PlatformSettingsSnapshot fields; got ${JSON.stringify(settingsKeys)}`,
  )
  for (const leakedKey of ["path", "envelope", "config", "provider", "providerStatus"]) {
    assert.ok(
      !(leakedKey in parsed.settings),
      `exported settings must NOT contain '${leakedKey}' (server-side detail)`,
    )
  }
  console.log("PASS: buildExportJson strips ActivePlatformSettings extras down to 5 snapshot fields")
}

async function main() {
  testProfileShapeStrict()
  testDraftSeedsNullForFiveRequiredFields()
  testNewEnumValuesOnly()
  testRejectsOldEnumLiterals()
  testCompleteDraftPassesValidation()
  testValidationRejectsMissingToken()
  testBuildPersistedProfileDropsRogueKeys()
  testFormatProfileChoiceNeverLeaksRawEnum()
  await testCsvHeaderHasOnlyFiveActiveFields()
  await testJsonExportHasNoLegacyBlock()
  await testJsonExportDoesNotLeakActiveSettings()
  await testStorageRoundtripPreservesFiveFieldShape()
  await testAtomicUpsertClearsStalePending()
  console.log("\nOK")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
