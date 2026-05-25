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

// Patterns that the advisor explicitly forbade from participant-visible copy
// (transcript: "受測者不需要了解 H1-base、H2-base、盲測、APT 等技術名詞" +
// "不要去, 第一個, 大語言模型...你要跟人家講金龍腦").
//
// Naming: `_CONFIG_PATTERNS` is the list tested against `visibleText` — the
// join of all participant-visible strings sourced from
// `web/config/evaluation.config.json` (study.title / rootTitle / eyebrow /
// intro / completion). For source-file scanning (.tsx) see
// `FORBIDDEN_SOURCE_PATTERNS` below.
//
// Why regex (not plain substring): the `Blind` token must match the
// standalone word in any boundary — trailing space, comma, period, EOL,
// JSX-quoted — while excluding `Blinded` / `Blinder`. Word-boundary regex
// `\bblind\b/i` handles all of these in a single pattern and covers both
// casings (e.g. `Blind Model Evaluation` header AND `blind evaluation`
// lowercase in meta description). For Chinese / acronym tokens, the `u`
// flag enables Unicode-aware matching and the unbounded form preserves the
// previous substring semantics (so `H1` still catches `H1-base`).
const FORBIDDEN_CONFIG_PATTERNS = [
  /大型語言模型/u,
  /APT/u,
  /H1/u,
  /H2/u,
  /TAIDE/u,
  /validation loss/u,
  /validation roles/u,
  /盲測/u,
  /H1-base/u,
  /H2-base/u,
  /主要分層變項/u,
  /預先指定/u,
  /\bblind\b/i,
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
// `\bblind\b/i` covers both casings (`Blind` / `blind`) and all boundaries
// (trailing space, comma, period, EOL, JSX-quoted) while excluding
// `Blinded` / `Blinder`. See FORBIDDEN_CONFIG_PATTERNS comment for full
// rationale.
const FORBIDDEN_SOURCE_PATTERNS = [/盲測/u, /\bblind\b/i]

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
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      check(
        !pattern.test(contents),
        `${relPath} must not match forbidden pattern ${String(pattern)}`,
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
  for (const pattern of FORBIDDEN_CONFIG_PATTERNS) {
    check(
      !pattern.test(visibleText),
      `participant intro must not match forbidden pattern ${String(pattern)}`,
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
