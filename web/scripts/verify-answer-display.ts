// Regression harness for participant answer-display text normalization.
// Run with:
//   cd web && npm run verify:answer-display
//
// Pins the spec scenarios under `Answer comparison presentation` that concern
// whitespace normalization: trim leading/trailing whitespace and collapse runs
// of 3+ consecutive newlines to a single blank line, while preserving a single
// newline (plain-text line breaks) and a single blank line (one paragraph gap).

import { strict as assert } from "node:assert"

import { normalizeAnswerText } from "@/lib/evaluation/answer-display"

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
  console.log("=== verify-answer-display ===")

  // Trims leading/trailing whitespace (incl. newlines) — the answer-card gap bug.
  check(
    normalizeAnswerText("\n\n\n定期定額…") === "定期定額…",
    "leading newlines trimmed",
  )
  check(
    normalizeAnswerText("答案結尾。\n\n  ") === "答案結尾。",
    "trailing whitespace trimmed",
  )

  // Collapses 3+ consecutive newlines to a single blank line (\n\n).
  check(
    normalizeAnswerText("a\n\n\n\nb") === "a\n\nb",
    "4 newlines collapse to one blank line",
  )
  check(
    normalizeAnswerText("a\n\n\nb") === "a\n\nb",
    "3 newlines collapse to one blank line",
  )

  // CRLF / lone-CR line endings are normalized to LF before collapsing, so a
  // CRLF blank-line run does not survive uncollapsed (S1 from review).
  check(
    normalizeAnswerText("a\r\n\r\n\r\n\r\nb") === "a\n\nb",
    "CRLF run normalized + collapsed to one blank line",
  )
  check(
    normalizeAnswerText("a\r\r\r\rb") === "a\n\nb",
    "lone CR run normalized + collapsed to one blank line",
  )

  // Preserves a single newline (plain-text numbered-list line breaks).
  check(
    normalizeAnswerText("1. 分散風險\n2. 紀律投資") === "1. 分散風險\n2. 紀律投資",
    "single newline preserved",
  )

  // Preserves a single blank line (one intentional paragraph gap).
  check(
    normalizeAnswerText("優點:\n\n1. 分散風險") === "優點:\n\n1. 分散風險",
    "single blank line preserved",
  )

  // Whitespace-only / empty input normalizes to empty string.
  check(normalizeAnswerText("   \n\n  ") === "", "whitespace-only string -> empty")
  check(normalizeAnswerText("") === "", "empty string -> empty")

  // Smoke assert via node:assert so a thrown error also fails the run loudly.
  assert.equal(normalizeAnswerText("  x  "), "x")

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) failed.`)
    process.exitCode = 1
    return
  }
  console.log("\nPASS: answer text normalization matches the spec.")
}

main()
