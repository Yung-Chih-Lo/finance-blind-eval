---
name: opsxp-archive
description: Archive a completed OpenSpec change using the official CLI, then push the branch and create a Pull Request. Use when an implementation is verified and ready to ship.
license: MIT
compatibility: "Requires openspec CLI ≥ 1.2.0. Optional: GitHub MCP server (falls back to compare URL)."
user-invocable: true
metadata:
  author: openspec-plus
  version: "3.0"
---

Archive a completed change using **`openspec archive -y`** (official CLI), then push and open a PR.

This skill does **not** write to Notion. After archive completes, optionally run `/opsxp-notion` to write the change back to its Notion task card and record any pitfalls hit.

**Input**: Optionally specify a change name. If omitted, infer from context. If ambiguous, MUST prompt.

---

## Pre-flight

Read `.claude/rules/project-commands.md` and `.claude/rules/openspec-git.md`.

If either is missing → STOP. Tell user to run `/opsxp-setup` first.

Read PR target branch from `openspec-git.md`. If still `(ASK USER AND MODIFY HERE)` → STOP.

Verify openspec CLI version:
```bash
openspec --version
```
Must be ≥ 1.2.0 for the modern archive flow. If older, tell user: `npm install -g @fission-ai/openspec@latest`.

---

## Steps

### 1. Select the change

If a name was provided, use it. Otherwise:
- `openspec list --json` → use **AskUserQuestion tool**
- Show only active (non-archived) changes
- Auto-select only if exactly one active change exists

### 1.5. Read PR metadata (if exists)

Check for `openspec/changes/<name>/.pr-info.json`. If present, parse:
- `pr_number`
- `pr_url`
- `notion_task_id`

This determines whether step 7 **upgrades an existing draft PR** (file exists) or **creates a new PR** (file absent).

### 2. Check artifact + task completion

```bash
openspec status --change "<name>" --json
```

Read `openspec/changes/<name>/tasks.md` and count `- [ ]` vs `- [x]`.

If artifacts not all `done` OR incomplete tasks exist:
- Show warning with counts
- Use **AskUserQuestion tool** to confirm proceeding
- Proceed only on explicit confirmation

### 3. Decide on spec sync mode

`openspec archive` auto-validates and merges delta specs into `openspec/specs/`. Decide which mode:

- **Default (full sync)** → `openspec archive -y "<name>"`
- **Skip specs** (for docs-only / infrastructure / tooling changes that have no spec impact) → `openspec archive -y --skip-specs "<name>"`

Auto-detect: if `openspec/changes/<name>/specs/` is empty or missing → use `--skip-specs`.
Otherwise default to full sync. Don't ask the user unless this auto-decision feels wrong.

### 4. Run the archive

```bash
openspec archive -y "<name>"
# or
openspec archive -y --skip-specs "<name>"
```

The CLI will:
- Validate the change structure
- Merge delta specs into `openspec/specs/<capability>/spec.md` (if not `--skip-specs`)
- Move the change to `openspec/changes/archive/YYYY-MM-DD-<name>/`

If the CLI fails:
- Read its error output
- Common cases: validation error → fix the artifact, re-run; permission error → check `~/.config/openspec/` ownership
- **Never fall back to manual `mv`** — the CLI is the source of truth

### 5. Commit the archive + spec sync

The CLI changes files but doesn't commit. Stage everything under `openspec/`:

```bash
git add openspec/
git status
```

Verify staged files are only `openspec/...` paths (no stray edits). Then:

```bash
git commit -m "chore: archive change <name>"
```

### 6. Push the branch

```bash
git push -u origin change/<name>
```

If push fails (no remote, rejected, etc.) → report exact error, STOP **without rolling back the archive** (the archive itself succeeded).

### 7. Update or create the Pull Request

Build PR body from the archived change files at `openspec/changes/archive/YYYY-MM-DD-<name>/`:

```markdown
## Summary
<from proposal.md "Why" section>

## What Was Built
<from tasks.md completed checkboxes>

## Key Decisions
<from design.md "Decisions" section if present>

## Specs
<list capabilities whose specs were updated, or "no spec changes" if --skip-specs>

<if notion_task_id from step 1.5: append "Notion task: [<task-id>]">
```

**Branch based on PR metadata from step 1.5**:

#### Case A: `.pr-info.json` was present → upgrade existing draft PR

A draft PR was opened at `/opsxp-ff` time. Now finalize it.

Use the GitHub MCP tool **`mcp__plugin_github_github__update_pull_request`** with:
- `pullNumber`: `<pr_number>` from `.pr-info.json`
- `body`: the assembled body above (replaces the stub)
- `draft`: **false** (un-draft → ready for review)
- `title`: only update if the change name changed since PR was opened (rare; usually omit this field)

This `draft: false` transition triggers Notion to move the linked task from "In Progress" to "In Review".

If MCP fails:
- Print: "Could not auto-upgrade PR #<pr_number>. Visit <pr_url>, replace the body with the text below, and click 'Ready for review':"
- Dump the body

#### Case B: `.pr-info.json` was absent → create a fresh PR

No draft PR exists (Notion task integration was off, or task ID was skipped at change creation).

Use the GitHub MCP tool **`mcp__plugin_github_github__create_pull_request`** with:
- `title`: `feat: <change-name>`
- `base`: PR target branch from `openspec-git.md`
- `head`: `change/<name>`
- `draft`: **false** (ready for review immediately)
- `body`: assembled above (without the Notion task line)

Do NOT use `mcp__plugin_github_github__create_pull_request_with_copilot`.

If MCP fails:
- Get owner/repo from `git remote get-url origin`
- Print compare URL: `https://github.com/<owner>/<repo>/compare/<target-branch>...change/<name>?expand=1`
- Tell user: "GitHub MCP failed. Open this URL to create the PR. Body to paste:" + dump body in code block

**Do NOT use `gh` CLI** — not installed.

### 8. Switch back to target branch

```bash
git checkout <target-branch>
```

### 9. Report

```
## Archive Complete

**Change**: <change-name>
**Archived to**: openspec/changes/archive/<date>-<name>/
**Spec sync**: <full sync | --skip-specs | no delta specs>
**Branch pushed**: change/<name> → origin
**Pull Request**: <PR URL> → <target-branch>
                  (or: "Manual — open <compare URL>")
**Switched to**: <target-branch>

To write this change back to its Notion task card (and optionally log pitfalls): /opsxp-notion
```

---

## Guardrails

- Refuse to run if `.claude/rules/project-commands.md` or PR target branch isn't configured
- Refuse to run if openspec CLI < 1.2.0
- **Always use `openspec archive -y` — never manual `mv`**. If the CLI errors, fix the underlying issue, don't bypass
- Never write to Notion from this skill
- Never use `gh` CLI
- If push fails, report the failure but don't try to "undo" the archive — that's the user's call
- Use `--skip-specs` only when there are genuinely no delta specs
