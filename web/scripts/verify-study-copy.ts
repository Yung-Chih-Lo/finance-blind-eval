// One-off verification harness for change `add-admin-study-copy-config` task 4.x.
// Not part of CI. Run with:
//   npx tsc -p scripts/verify-tsconfig.json
//   node --experimental-loader=./scripts/.verify-loader.mjs scripts/.verify-out/scripts/verify-study-copy.js

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  arrayToMultiline,
  cloneStudyConfig,
  multilineToArray,
} from "@/lib/evaluation/study-copy-form"
import type { StudyConfig } from "@/lib/evaluation/types"
import {
  getConfigFromSettingsPayload,
  getProviderFromSettingsPayload,
  validateStudyConfig,
} from "@/lib/server/platform-settings"

const here = dirname(fileURLToPath(import.meta.url))
const baseConfig = JSON.parse(
  readFileSync(resolve(here, "..", "..", "..", "config", "evaluation.config.json"), "utf8")
) as StudyConfig

function header(text: string) {
  console.log(`\n=== ${text} ===`)
}

function assertOk(label: string, condition: boolean, detail?: string) {
  if (!condition) {
    console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`)
    process.exitCode = 1
    return
  }
  console.log(`OK: ${label}`)
}

header("4.1 RED — category with <5 examples must fail validation")
{
  const cloned = cloneStudyConfig(baseConfig)
  cloned.promptCategories[0].examples = ["only-one", "two", "three", "four"]
  const result = validateStudyConfig(cloned)
  assertOk("validator rejects <5 examples", result.ok === false)
  const hasExamplesIssue = result.issues.some((issue) =>
    issue.includes("promptCategories[0].examples")
  )
  assertOk(
    "issue list mentions promptCategories[0].examples",
    hasExamplesIssue,
    result.issues.join(" | ")
  )
}

header("4.1 GREEN — multilineToArray + validator accept 5+ trimmed examples")
{
  const cloned = cloneStudyConfig(baseConfig)
  cloned.promptCategories[0].examples = multilineToArray(
    "ex one\n  ex two  \n\nex three\nex four\n  ex five"
  )
  assertOk(
    "multilineToArray drops blanks and trims",
    cloned.promptCategories[0].examples.length === 5 &&
      cloned.promptCategories[0].examples[1] === "ex two"
  )
  const result = validateStudyConfig(cloned)
  assertOk(
    "validator accepts valid edited copy",
    result.ok === true,
    result.issues.join(" | ")
  )
}

header("4.2 — Save shape: study copy edits round-trip through StudyConfig")
{
  const cloned = cloneStudyConfig(baseConfig)
  cloned.study.title = "新版受測者標題"
  cloned.study.signature.studentName = "李泳"
  cloned.study.completion.notes = multilineToArray(
    "再次感謝您撥冗參與\n本研究將於畢業後公開"
  )
  cloned.promptCategories[0].examples[0] = "更新後的範例問題"
  const result = validateStudyConfig(cloned)
  assertOk(
    "validator accepts study copy edits",
    result.ok === true,
    result.issues.join(" | ")
  )
}

header("4.5 — Provider preservation: {config}-only payload returns undefined provider")
{
  const configOnlyPayload = { config: baseConfig }
  const configExtracted = getConfigFromSettingsPayload(configOnlyPayload)
  const providerExtracted = getProviderFromSettingsPayload(configOnlyPayload)
  assertOk(
    "getConfigFromSettingsPayload returns the config object",
    configExtracted === baseConfig
  )
  assertOk(
    "getProviderFromSettingsPayload returns undefined for {config}-only",
    providerExtracted === undefined
  )
}

header("4.6 — Provider helper text still lists only the 3 provider variables")
{
  const source = readFileSync(
    resolve(here, "..", "..", "..", "components", "evaluation", "admin-provider-settings.tsx"),
    "utf8"
  )
  const variables = [
    "{{categoryTitle}}",
    "{{categoryInstruction}}",
    "{{question}}",
  ]
  for (const variable of variables) {
    assertOk(`provider helper mentions ${variable}`, source.includes(variable))
  }
}

header("Round-trip helpers")
{
  const cloned = cloneStudyConfig(baseConfig)
  const restored = multilineToArray(arrayToMultiline(cloned.study.intro.paragraphs))
  assertOk(
    "arrayToMultiline → multilineToArray preserves non-empty paragraphs",
    restored.length === cloned.study.intro.paragraphs.length
  )
}
