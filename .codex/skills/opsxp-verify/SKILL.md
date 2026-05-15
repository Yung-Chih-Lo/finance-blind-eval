---
name: opsxp-verify
description: "Verify implementation matches change artifacts with mandatory fresh evidence and multi-perspective agent review. Use to validate completeness, correctness, and coherence before archiving."
license: MIT
compatibility: "Requires openspec CLI. Reads test/lint commands from .claude/rules/project-commands.md."
user-invocable: true
metadata:
  author: openspec-plus
  version: "3.0"
---

Verify that an implementation matches the change artifacts (specs, tasks, design).

**Input**: Optionally specify a change name. If ambiguous, MUST prompt.

---

## Pre-flight

Read `.claude/rules/project-commands.md`. Extract `test_command`, `lint_command`, `typecheck_command`.

If file missing → STOP and tell user to run `/opsxp-setup`.

If a command is `<not configured>`, skip the corresponding step (don't error).

---

## The Verification Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

Every check MUST produce evidence from commands run **in this message**.

### The Gate Function

Before any positive claim:
1. **IDENTIFY**: What command proves this?
2. **RUN**: Execute it now in this message
3. **READ**: Full output, exit code, failure count
4. **VERIFY**: Output confirms?
5. **ONLY THEN**: Claim with evidence

---

## Steps

### 1. Select the change

If a name was provided, use it. Otherwise:
- Run `openspec list --json`
- **Auto-select if exactly one active change exists**
- Otherwise use **AskUserQuestion tool** to disambiguate

Announce: "Verifying change: <name>"

### 2. Check status

```bash
openspec status --change "<name>" --json
```

### 3. Validate change structure (OpenSpec native)

Run the official structural validator **before** any custom checks:

```bash
openspec validate "<name>" --type change --strict --json
```

`--type change` disambiguates when a change name accidentally matches a spec capability name. Without it, OpenSpec may resolve the name to the wrong item type silently.

If exit code ≠ 0:
- Parse JSON for the failed assertions
- Report as **CRITICAL** issues — `archive` will refuse to run on a failing structure
- Continue with the rest of verify (so user sees full picture), but flag this prominently in the final report

This step catches malformed delta specs, missing requirements, broken task syntax — issues our manual checks may miss.

### 4. Load artifacts

```bash
openspec instructions apply --change "<name>" --json
```

Read all `contextFiles`.

### 5. Run project verification commands

Use the commands from pre-flight:

```bash
<test_command>
<lint_command>
<typecheck_command>   # skip if <not configured>
```

Record exit codes, pass/fail counts, errors. Used as evidence throughout.

### 6. Verify Completeness

**Task Completion**: Parse `tasks.md` checkboxes. Count complete vs total.
- Incomplete tasks → **CRITICAL**

**Spec Coverage**: Extract requirements from delta specs. Search the codebase for each.
- Unimplemented requirements → **CRITICAL**

### 7. Verify Correctness

**Requirement Mapping**: For each spec requirement, point to implementation evidence (file:line).
- Divergence from spec → **WARNING**

**Scenario Coverage**: Check spec scenarios against code and tests.
- Uncovered scenarios → **WARNING**

**Test Evidence**: Report actual results from step 5.
- Failures → **CRITICAL**

### 8. Verify Coherence

**Design Adherence**: Implementation matches `design.md` decisions?
- Contradiction → **WARNING**

**Code Quality**: Linter / typecheck results from step 5.
- Errors → **WARNING**

### 9. Multi-perspective Agent Review

After automated checks pass, launch **3 parallel Agent calls** (single message, multiple tool blocks). Each agent receives: delta specs, design, tasks, and the list of modified files.

| Agent | Perspective | Focus |
|---|---|---|
| **Normal User** | End-user using the feature | Happy path, UX expectations, does it match spec? |
| **Adversarial QA** | Malicious or careless user | Edge cases, boundaries, empty/null/extreme inputs, security holes, missing error handling |
| **Future Maintainer** | Developer inheriting this code | Readability, naming, test quality, missing comments on non-obvious logic |

Each agent:
1. Reads the delta specs and design for context
2. Reads the actual implementation files
3. Returns a short list of concrete issues, or "No issues found"

Merge findings into a **## Perspectives** section in the report.

**Skip conditions**: Trivial change (config-only, docs-only, < 3 files changed) → skip and note "Agent review skipped — trivial change."

### 10. Generate Report

```
## Verification Report: <change-name>

### Evidence
- openspec validate --strict: clean (exit 0)
- <test_command>: 47/47 passed (exit 0)
- <lint_command>: clean (exit 0)
- <typecheck_command>: clean (exit 0)

### Summary
| Dimension    | Status            |
|--------------|-------------------|
| Completeness | X/Y tasks, N reqs |
| Correctness  | M/N reqs covered  |
| Coherence    | Followed/Issues   |

### Perspectives
**Normal User**: <findings or "No issues found">
**Adversarial QA**: <findings>
**Future Maintainer**: <findings>
```

**Issues by Priority**:
1. **CRITICAL** — must fix before archive
2. **WARNING** — should fix
3. **SUGGESTION** — nice to fix

**Final Assessment**:
- CRITICAL → "Fix before archiving."
- Warnings only → "Ready for archive with noted improvements."
- All clear → "All checks passed. Ready for `/opsxp-archive`."

---

## Red Flags — STOP Yourself

- Using "should", "probably", "seems to"
- Claiming pass before running commands
- "All clear" without test output in this message
- Trusting previous runs
- Skipping linter because tests pass

---

## Graceful Degradation

- Only `tasks.md` exists: verify task completion + run available commands
- Tasks + specs: verify completeness + correctness
- Full artifacts: all three dimensions
- **Always run available verification commands**

---

## Guardrails

- Refuse to run if `project-commands.md` is missing
- All claims must come from commands run in this message
- Don't auto-archive after verify — that's the user's decision
