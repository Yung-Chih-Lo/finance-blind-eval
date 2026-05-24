// Regression harness for the provider-side DEFAULT_SYSTEM_PROMPT (finance-brain).
// Run with:
//   cd web && npm run verify:system-prompt
//
// Pins the spec scenarios under `Provider default system prompt finance-brain
// scope`. The script clears OPENAI_COMPAT_SYSTEM_PROMPT before calling
// `getDefaultProviderSettings()` so the assertion target is the in-code default,
// not whatever the local shell happens to export.

import { strict as assert } from "node:assert"

// Clear env override BEFORE the dynamic import so module-level constants resolve
// against the hardcoded default. Required because provider-settings.ts reads env
// only inside `getDefaultProviderSettings()`, not at import time — but other
// modules in the same import chain may capture env eagerly, so we belt-and-brace.
delete process.env.OPENAI_COMPAT_SYSTEM_PROMPT

import { getDefaultProviderSettings } from "@/lib/server/provider-settings"

const failures: string[] = []

function check(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message)
    console.error(`[FAIL] ${message}`)
  } else {
    console.log(`[OK] ${message}`)
  }
}

function main() {
  console.log("=== verify-system-prompt-defaults ===")

  const settings = getDefaultProviderSettings()
  const prompt = settings.systemPrompt

  check(typeof prompt === "string" && prompt.length > 0, "systemPrompt must be a non-empty string")
  if (typeof prompt !== "string" || prompt.length === 0) {
    process.exitCode = 1
    return
  }

  // Finance-brain identity declaration.
  const identityKeywords = ["金融腦", "金融語言模型"]
  check(
    identityKeywords.some((keyword) => prompt.includes(keyword)),
    `systemPrompt must declare identity as one of: ${identityKeywords.join(" / ")}`,
  )

  // Topical scope listing.
  const scopeKeywords = ["金融", "投資", "財務", "會計", "總經", "市場"]
  for (const keyword of scopeKeywords) {
    check(prompt.includes(keyword), `systemPrompt must list "${keyword}" as in-scope`)
  }

  // Refusal phrase for non-finance questions.
  check(
    /不|無法|拒|範圍|無法回答/.test(prompt),
    "systemPrompt must contain refusal phrasing for non-finance questions",
  )

  // Refusal phrase for real-time / external-tool queries.
  check(
    /即時|實時|最新|查詢|工具/.test(prompt),
    "systemPrompt must contain refusal phrasing for real-time / external-tool queries",
  )

  // Traditional Chinese requirement.
  check(prompt.includes("繁體中文"), 'systemPrompt must require Traditional Chinese ("繁體中文") output')

  // Forbidden: evaluation-metadata leakage. Reject if any of these are present.
  // Case-sensitive `model` to avoid false positives on legit Chinese text, but
  // catch English mentions like `model name` or `the model`.
  const forbiddenSubstrings = ["A/B/C", "盲測", "H1", "H2", "TAIDE"]
  for (const forbidden of forbiddenSubstrings) {
    check(!prompt.includes(forbidden), `systemPrompt must NOT mention "${forbidden}"`)
  }
  // English `model` as a standalone word — allowed inside Chinese phrases like
  // 金融語言模型 (which contains the Chinese 模型 not English `model`).
  check(
    !/\bmodel\b/i.test(prompt),
    'systemPrompt must NOT contain the English standalone word "model"',
  )

  // Cross-check: same default must apply to all three internal model IDs. The
  // provider settings shape exposes a single `systemPrompt`, so this is true by
  // construction — we assert it stays that way (no per-model field has snuck in).
  const settingsKeys = Object.keys(settings)
  const perModelPromptKeys = settingsKeys.filter((key) => /^systemPrompt[A-Z]/.test(key))
  check(
    perModelPromptKeys.length === 0,
    `provider settings must NOT introduce per-model systemPrompt overrides; found: ${perModelPromptKeys.join(", ")}`,
  )

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) failed.`)
    process.exitCode = 1
    return
  }
  console.log("\nPASS: DEFAULT_SYSTEM_PROMPT enforces finance-brain scope across all required dimensions.")
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
