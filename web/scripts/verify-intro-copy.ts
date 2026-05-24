// Regression harness for the participant-facing intro / signature copy.
// Run with:
//   cd web && npm run verify:intro-copy
//
// Pins the spec scenarios under `Participant intro neutral terminology`
// (align-advisor-feedback-copy-and-prompt). Does NOT touch .data — pure
// static-content check on the repository default StudyConfig.

import { strict as assert } from "node:assert"

import studyConfig from "@/config/evaluation.config.json"

// Strings that the advisor explicitly forbade from participant-visible copy
// (transcript: "受測者不需要了解 H1-base、H2-base、盲測、APT 等技術名詞" +
// "不要去, 第一個, 大語言模型...你要跟人家講金龍腦").
const FORBIDDEN_KEYWORDS = [
  "大型語言模型",
  "APT",
  "H1",
  "H2",
  "TAIDE",
  "validation loss",
  "validation roles",
  "盲測",
  "H1-base",
  "H2-base",
  "主要分層變項",
  "預先指定",
]

// At least one of these must appear so the participant frames the system as
// finance-domain rather than as a generic chatbot.
const REQUIRED_FRAMING_KEYWORDS = ["金融語言模型", "金融腦"]

// Thesis title must not leak the APT acronym or its expansion.
const FORBIDDEN_THESIS_TOKENS = ["Augmentative", "Residual", "Adapter", "APT"]

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
  console.log("=== verify-intro-copy ===")
  const intro = studyConfig.study.intro as { greeting: string; paragraphs: string[]; tasks: string[] }
  const signature = studyConfig.study.signature as { thesisTitle: string }

  // Paragraph / task structure.
  check(
    Array.isArray(intro.paragraphs) && intro.paragraphs.length === 4,
    `study.intro.paragraphs must have exactly 4 entries (got ${intro.paragraphs?.length ?? "n/a"})`,
  )
  check(
    Array.isArray(intro.tasks) && intro.tasks.length === 3,
    `study.intro.tasks must have exactly 3 entries (got ${intro.tasks?.length ?? "n/a"})`,
  )

  // Forbidden-keyword scan across the concatenated paragraphs + tasks (tasks
  // are also participant-visible, so they share the same prohibition).
  const visibleText = [intro.greeting, ...intro.paragraphs, ...intro.tasks].join("\n")
  for (const forbidden of FORBIDDEN_KEYWORDS) {
    check(
      !visibleText.includes(forbidden),
      `participant intro must not contain forbidden term "${forbidden}"`,
    )
  }

  // Required finance-domain framing.
  const hasFraming = REQUIRED_FRAMING_KEYWORDS.some((keyword) => visibleText.includes(keyword))
  check(
    hasFraming,
    `participant intro must include at least one of: ${REQUIRED_FRAMING_KEYWORDS.join(" / ")}`,
  )

  // Thesis title must avoid APT-revealing tokens.
  check(
    typeof signature.thesisTitle === "string" && signature.thesisTitle.length > 0,
    "study.signature.thesisTitle must be a non-empty string",
  )
  for (const token of FORBIDDEN_THESIS_TOKENS) {
    check(
      !signature.thesisTitle.includes(token),
      `study.signature.thesisTitle must not contain "${token}"`,
    )
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) failed.`)
    process.exitCode = 1
    return
  }
  console.log("\nPASS: intro / signature copy is neutral and finance-framed.")
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
