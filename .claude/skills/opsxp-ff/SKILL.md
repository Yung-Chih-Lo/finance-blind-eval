---
name: opsxp-ff
description: Fast-forward through OpenSpec artifact creation with enhanced task quality. Use when the user wants to quickly create all artifacts needed for implementation.
license: MIT
compatibility: Requires openspec CLI. Requires `/opsxp-setup` to have been run.
user_invocable: true
metadata:
  author: openspec-plus
  version: "3.1"
---

Fast-forward through artifact creation — generate everything needed to start implementation in one go.

**Input**: A change name (kebab-case) OR a description of what to build.

---

## Pre-flight

1. Check `.claude/rules/project-commands.md` exists.
   - Missing → STOP. Print: "Project not initialized. Run `/opsxp-setup` first."
2. Read `.claude/rules/openspec-git.md`. Confirm PR target branch is set (not `(ASK USER AND MODIFY HERE)`).
   - Still placeholder → STOP. Print: "PR target branch not configured. Run `/opsxp-setup` first."

---

## Steps

### 1. If no clear input, ask

Use **AskUserQuestion tool** (open-ended):
> "What change do you want to work on? Describe what you want to build or fix."

Derive a kebab-case name.

### 2. Create the change directory

```bash
openspec new change "<name>"
```

### 3. Create a feature branch

Read PR target branch from `.claude/rules/openspec-git.md`.

```bash
git checkout -b change/<name>
```

If the target branch doesn't exist locally:
```bash
git fetch origin <target>
git checkout -b change/<name> origin/<target>
```

### 4. Get the artifact build order

```bash
openspec status --change "<name>" --json
```

Parse:
- `applyRequires` — artifacts needed before implementation
- `artifacts` — list with status and dependencies

### 5. Create artifacts in sequence until apply-ready

Loop through artifacts in dependency order:

a. **For each artifact that is `ready`**:
   - `openspec instructions <artifact-id> --change "<name>" --json`
   - Read completed dependency files for context
   - Create the artifact file using `template` as structure
   - Apply `context` and `rules` as constraints — do NOT copy them into the file
   - Show: "Created <artifact-id>"

b. **Continue until all `applyRequires` are complete**

c. **If an artifact requires user input**: use **AskUserQuestion tool**

### 6. Show final status

```bash
openspec status --change "<name>"
```

### 7. Open draft PR (if Notion task integration enabled)

Read `.claude/opsxp.json`. If file missing OR `task_integration_enabled` is `false` → SKIP this step entirely.

Otherwise read `project_slug` from the same file — keep it for step 7e.

**a. Ask for Notion task** — use **AskUserQuestion tool** (open input):
> "Notion 任務卡 URL（推薦）或 ID（例如 YSH-48），或留空跳過 PR 建立"

Accept three forms:
- **Notion URL** (preferred): keep the full URL as `notion_task_url`. Extract the trailing 32-char hex page ID as `notion_task_id`. If the URL slug or page title contains a `[XXX-N]` style task code, use that for the PR title; otherwise use the page ID.
- **Bare ID**: `YSH-48` → set `notion_task_id = "YSH-48"`, leave `notion_task_url` empty (or fetch the page to derive URL if MCP available — optional).
- **Empty / "skip" / "none"** → SKIP rest of this step (no PR, no `.pr-info.json`).

**b. Stage all generated artifacts as the initial commit**

```bash
git add openspec/changes/<name>/
git commit -m "chore: open <name> [<task-id>]"
```

**c. Push branch**

```bash
git push -u origin change/<name>
```

**d. Open the draft PR**

Use the GitHub MCP tool **`mcp__plugin_github_github__create_pull_request`** with:
- `title`: `[<task-id>] feat: <change-name>` (e.g., `[YSH-48] feat: add-user-auth`)
- `base`: PR target branch from `openspec-git.md`
- `head`: `change/<name>`
- `draft`: **true**
- `body` (stub):
  ```markdown
  > 🚧 Change in progress. Body will be updated when `/opsxp-archive` runs.

  Notion task: [<task-id>]
  ```

Do NOT use `mcp__plugin_github_github__create_pull_request_with_copilot` — that delegates to Copilot.

**e. Save PR metadata**

Write `openspec/changes/<name>/.pr-info.json`:
```json
{
  "notion_task_id": "<task-id>",
  "notion_task_url": "<full Notion URL or empty string>",
  "project_slug": "<slug from .claude/opsxp.json>",
  "pr_number": <number>,
  "pr_url": "<url>"
}
```

`notion_task_url` and `project_slug` are required by `/opsxp-notion` to write back to the task card and to tag pitfall pages. If the user only gave a bare ID (no URL), set `notion_task_url` to empty string — `/opsxp-notion` will then resolve it via Notion search using the ID.

**Fallback if MCP fails**: print compare URL + title/body to paste; do NOT block ff. User can manually open PR and create `.pr-info.json` later.

---

## Output

Summarize:
- Change name and location
- Artifacts created
- "All artifacts created! Ready for implementation."
- Prompt: "Run `/opsxp-apply` to start implementing."

---

## Enhanced Task Writing (for tasks artifact)

Apply these standards when writing the **tasks artifact**:

### Bite-Sized Granularity

Each step = one action (2-5 minutes):

```markdown
- [ ] Write failing test for user registration endpoint
- [ ] Run test, verify it fails with "function not defined"
- [ ] Implement minimal registration handler to pass test
- [ ] Run test suite, verify all pass
```

NOT: `- [ ] Implement user registration with validation and error handling`

### TDD Structure

```markdown
### Feature: User Registration

- [ ] RED: Write test `test_register_creates_user` — POST /register returns 201
- [ ] Verify RED: <single-test invocation> → FAIL
- [ ] GREEN: Implement `register()` handler with minimal logic
- [ ] Verify GREEN: <test_command> → ALL PASS
- [ ] REFACTOR: Extract validation if duplicated
```

### No Placeholders

Every task must contain enough detail to execute. These are **plan failures**:
- "TBD", "TODO", "implement later"
- "Add appropriate error handling"
- "Write tests for the above" (without specifics)
- "Similar to task above" (repeat the specifics)
- References to undefined types/functions

### File Structure Mapping

Before writing tasks, map files:

```markdown
## File Plan
- Create: `src/api/auth.ts` — registration and login handlers
- Create: `tests/auth.test.ts` — auth endpoint tests
- Modify: `src/api/router.ts:15-20` — add auth routes
```

### Self-Review

After writing all tasks:
1. **Spec coverage**: every requirement has a task?
2. **Placeholder scan**: no "TBD", vague instructions?
3. **Consistency**: names and paths match across tasks?

---

## Artifact Creation Guidelines

- Follow the `instruction` field from `openspec instructions`
- Read dependency artifacts for context before creating new ones
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file

---

## Guardrails

- Refuse to run without `/opsxp-setup` complete
- Create ALL artifacts needed for implementation
- If context is critically unclear, ask the user (use AskUserQuestion)
- If a change with that name exists, suggest checking out the existing branch instead
- Verify each artifact file exists after writing
