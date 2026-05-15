---
name: opsxp-apply
description: Implement tasks from an OpenSpec change using strict TDD. Use when the user wants to start, continue, or work through implementation tasks.
license: MIT
compatibility: "Requires openspec CLI. Reads test/lint commands from .claude/rules/project-commands.md."
user-invocable: true
metadata:
  author: openspec-plus
  version: "3.0"
---

Implement tasks from an OpenSpec change using **strict Test-Driven Development**.

**Input**: Optionally specify a change name. If omitted, infer from context. If ambiguous, prompt.

---

## Pre-flight

Read `.claude/rules/project-commands.md`. Extract:
- `test_command` (from `## Test` section)
- `lint_command` (from `## Lint`)
- `typecheck_command` (from `## Typecheck`)

If file missing → STOP and tell user to run `/opsxp-setup`.

If a command is `<not configured>`, skip steps that require it (don't error).

**Stack-specific test patterns** (use these to construct single-test invocations):

| Stack hint (from project-commands.md) | Single-test pattern |
|---|---|
| `pytest ...` | `pytest path/to/test.py::test_name -v` |
| `npm test` / `vitest` | `npx vitest run path/to/test.spec.ts -t "test name"` |
| `jest` | `npx jest path/to/test.spec.ts -t "test name"` |
| `npm run test:unit` | use the same — append file path |

---

## The TDD Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
NO IMPLEMENTATION WITHOUT POSTING THE FAILURE OUTPUT IN THIS MESSAGE
```

Non-negotiable. Every task involving production code MUST follow Red-Green-Refactor.

**Exceptions** (ask user first): pure config files, generated code, pure UI markup with no logic, infrastructure scripts.

---

## Steps

### 1. Select the change

If a name is provided, use it. Otherwise:
- Infer from conversation context
- Auto-select if exactly one active change
- If ambiguous: `openspec list --json` + **AskUserQuestion tool**

Announce: "Using change: <name>"

### 2. Check status

```bash
openspec status --change "<name>" --json
```

### 3. Get apply instructions

```bash
openspec instructions apply --change "<name>" --json
```

**Handle states**:
- `state: "blocked"` → report the blocker (which artifact and why), STOP
- `state: "all_done"` → congratulate, suggest `/opsxp-verify`, STOP
- otherwise → proceed

### 4. Read context files from `contextFiles`.

### 5. Show progress

Schema, "N/M tasks complete", remaining tasks.

### 6. Implement tasks (loop until done or blocked)

For each pending task, follow the **RED Gate** strictly:

#### RED — Write failing test

- One minimal test describing the expected behavior
- Use real code (no placeholders)
- Clear name describing the scenario

#### Verify RED — MANDATORY

Run the single-test command using the pattern from pre-flight:

```bash
<single-test invocation>
```

**STOP and post the output in this message.** Then check:

| Output type | Action |
|---|---|
| `AssertionError` / explicit assertion failure | ✓ proceed to GREEN |
| `ImportError` / `ModuleNotFoundError` / `SyntaxError` | ✗ test is broken, fix the test, re-run |
| Test passes | ✗ test isn't testing the new behavior — strengthen it, re-run |
| Other error (fixture missing, etc.) | ✗ fix the test setup, re-run |

**RED Gate Red Flags — STOP immediately**:
- Skipping the test run
- Writing implementation before posting failure output
- Saying "the test would fail because..." without running it

#### GREEN — Minimal implementation

Write the simplest code that makes the test pass. Nothing more.

#### Verify GREEN — MANDATORY

```bash
<single-test invocation>     # the new test must pass
<test_command>               # full suite must still pass
```

Post both outputs.

If the new test still fails after the implementation:
- Increment the **failure counter for this task** (mental tally)
- Try another implementation

**Three-strike rule**: If the same task hits 3 GREEN failures in a row → **STOP**. Print:
```
This task has failed 3 implementation attempts.
The design may be wrong. Suggested next step:
  - Re-read design.md and the spec for this requirement
  - Or enter explore mode (`/opsxp-explore`) to rethink
Do NOT keep retrying.
```

#### REFACTOR (only after GREEN)

Remove duplication, improve names. Re-run `<test_command>` after each refactor.

#### Mark task complete

Update `tasks.md`: `- [ ]` → `- [x]`.

**Evidence required** — the test output must be in this message.

#### Auto-commit

Stage only the files touched by this task:
```bash
git add <source files> <test files>
git commit -m "feat(<change-name>): task <N> - <short task description>"
```

Follow the format in `.claude/rules/openspec-git.md`. **Do NOT use `git add -A`.**

#### Auto-push (if draft PR exists)

If `openspec/changes/<change-name>/.pr-info.json` exists:
```bash
git push
```
This keeps the draft PR up to date so Notion (via PR title `[<task-id>]` integration) reflects "In Progress" with live commits.

If push fails (e.g., remote branch deleted) → report once, continue without push for this run. Don't re-attempt.

If `.pr-info.json` is absent → skip push. The change isn't tracked in Notion via PR; commits stay local until `/opsxp-archive`.

#### Pause if

- Task description is unclear
- Implementation reveals a design issue
- Three-strike rule triggered
- User interrupts

### 7. On completion / pause, show status

Tasks completed, overall progress, recommended next step.

---

## Verification Before Any Positive Claim

1. **IDENTIFY**: What command proves the claim?
2. **RUN**: Execute it now in this message
3. **READ**: Full output, exit code
4. **VERIFY**: Output confirms the claim?
5. **ONLY THEN**: Make the claim, with the output as evidence

---

## Output

```
## Implementing: <change-name>

Working on task 3/7: <description>

RED:
  $ <single-test invocation>
  → AssertionError: expected ... got ... (✓ failure as expected)

GREEN:
  <code change summary>
  $ <single-test invocation>  → PASS
  $ <test_command>            → 34/34 PASS

Task 3 complete. Committed: feat(<name>): task 3 - <description>
```

**On completion**:
```
## Implementation Complete

**Change**: <change-name>
**Progress**: 7/7 tasks

### Verification
$ <test_command>      → 47/47 PASS
$ <lint_command>      → clean
$ <typecheck_command> → clean

Run `/opsxp-verify` next, then `/opsxp-archive`.
```

---

## Guardrails

- Read `project-commands.md` first; refuse to run if missing
- TDD for every task involving production code (exceptions require user OK)
- Read context files before starting
- Keep changes minimal and scoped to each task
- Update task checkbox immediately after evidence is posted
- **Never claim completion without test output in this message**
- Three-strike rule is non-negotiable — stop and re-think, don't grind
