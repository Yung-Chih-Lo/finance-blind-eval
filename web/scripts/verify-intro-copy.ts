// Regression harness for the participant-facing intro / signature copy.
// Run with:
//   cd web && npm run verify:intro-copy
//
// Pins the spec scenarios under `Participant intro neutral terminology`
// (align-advisor-feedback-copy-and-prompt). Does NOT touch .data — pure
// static-content check on the repository default StudyConfig.

import fs from "node:fs"
import path from "node:path"

import studyConfig from "@/config/evaluation.config.json"

// Strings that the advisor explicitly forbade from participant-visible copy
// (transcript: "受測者不需要了解 H1-base、H2-base、盲測、APT 等技術名詞" +
// "不要去, 第一個, 大語言模型...你要跟人家講金龍腦").
//
// Naming: `_CONFIG_KEYWORDS` is the list scanned against `visibleText` —
// the join of all participant-visible strings sourced from
// `web/config/evaluation.config.json` (study.title / rootTitle / eyebrow /
// intro / completion). For source-file scanning (.tsx) see
// `FORBIDDEN_SOURCE_TOKENS` below.
const FORBIDDEN_CONFIG_KEYWORDS = [
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
  // Trailing space avoids false positives on Blinded / Blinder; pins the
  // English caption variant of 盲測 (e.g. legacy `Blind Model Evaluation`).
  // Both casings checked — pages can use either as a freestanding word.
  "Blind ",
  "blind ",
]

// At least one of these must appear so the participant frames the system as
// finance-domain rather than as a generic chatbot.
const REQUIRED_FRAMING_KEYWORDS = ["金融語言模型", "金融腦"]

// Thesis title must not leak the APT acronym or its expansion.
const FORBIDDEN_THESIS_TOKENS = ["Augmentative", "Residual", "Adapter", "APT"]

// Participant-facing source files whose .tsx text is scanned for hard-coded
// jargon (JSX literals + aria-labels + Next.js metadata exports). Config-only
// checks cannot reach these — see remove-blind-test-jargon-from-participant-copy
// design D3 + the "Page metadata avoids technical jargon" spec scenario.
//
// MAINTENANCE NOTE: when adding a new participant-facing source file
// (component, page, layout, or any file whose strings render to the
// participant), add its path here. Admin-only files (e.g. `app/admin/*`)
// must NOT be added — researcher-facing strings such as `盲測資料後台` are
// intentionally exempt per design D6 / proposal Impact "Admin path
// unaffected".
const PARTICIPANT_SOURCE_FILES = [
  "components/evaluation/token-entry.tsx",
  "components/evaluation/profile-form.tsx",
  "components/evaluation/question-flow.tsx",
  // HTML metadata (browser tab title + meta description) — leaks at the
  // root layout, visible on every route in the participant flow.
  "app/layout.tsx",
]
// Trailing space avoids false positives on Blinded / Blinder; both casings
// checked since metadata.description-style sentences may lowercase the word.
const FORBIDDEN_SOURCE_TOKENS = ["盲測", "Blind ", "blind "]

const failures: string[] = []

function check(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message)
    console.error(`[FAIL] ${message}`)
  } else {
    console.log(`[OK] ${message}`)
  }
}

function testSourceFilesAvoidJargon() {
  // npm scripts run from web/ (package.json directory), so resolving from
  // process.cwd() lands on the participant source files.
  for (const relPath of PARTICIPANT_SOURCE_FILES) {
    const fullPath = path.resolve(process.cwd(), relPath)
    const contents = fs.readFileSync(fullPath, "utf8")
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      check(
        !contents.includes(token),
        `${relPath} must not contain forbidden token "${token}"`,
      )
    }
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

  // Forbidden-keyword scan across the concatenated participant-visible text:
  // intro greeting + paragraphs + tasks + page header (title / rootTitle /
  // eyebrow) + completion screen (title / description / notes).
  const completion = studyConfig.study.completion as {
    title: string
    description: string
    notes: string[]
  }
  const visibleText = [
    intro.greeting,
    ...intro.paragraphs,
    ...intro.tasks,
    studyConfig.study.title,
    studyConfig.study.rootTitle,
    studyConfig.study.eyebrow,
    completion.title,
    completion.description,
    ...completion.notes,
  ].join("\n")
  for (const forbidden of FORBIDDEN_CONFIG_KEYWORDS) {
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

  // Source-file scan: catches participant-facing JSX strings + Next.js
  // metadata exports that the config-level checks above cannot see.
  testSourceFilesAvoidJargon()

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
