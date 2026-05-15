---
name: opsxp-notion
description: Write progress back to a Notion task card after archive, and optionally record any pitfalls hit during the change. Use this manually after `/opsxp-archive` when the change is worth journaling.
license: MIT
compatibility: "Requires Notion MCP server. Notion task integration must be enabled via `/opsxp-setup`."
user-invocable: true
metadata:
  author: openspec-plus
  version: "2.0"
---

Update the Notion task card linked to an archived change with a structured 7-section summary, then optionally create a "踩到的坑" entry in the shared pitfall database.

This skill is **never auto-triggered** — only you decide when a change is worth journaling. `/opsxp-archive` will print a one-line reminder when it finishes; you choose whether to follow up.

---

## Pre-flight

1. **Project-level config**: read `.claude/opsxp.json`.
   - File missing → "Notion is not enabled for this project. Run `/opsxp-setup` to enable." STOP.
   - `task_integration_enabled` is `false` → "Task integration disabled. Run `/opsxp-setup` to enable." STOP.
   - Read `project_slug` (required for pitfall tagging).

2. **User-level pitfall config**: read `~/.claude/rules/notion-pitfalls.md`.
   - Missing → task card writeback (steps 1–7) still works; pitfall recording (steps 8–9) is unavailable. Print warning at start, continue.
   - Otherwise read `## Database ID`.

---

## Steps

### 1. Pick an archived change

List the 5 most recently archived changes:

```bash
ls -1t openspec/changes/archive/ | head -5
```

Use **AskUserQuestion tool** to let the user select. Names look like `2026-04-30-add-user-auth`.

If no archives exist → "No archived changes found. Run `/opsxp-archive` first." STOP.

### 2. Read PR metadata

Read `openspec/changes/archive/<selected>/.pr-info.json`. Required fields:
- `notion_task_id` and/or `notion_task_url`
- `project_slug` (fallback to `.claude/opsxp.json`'s `project_slug` if absent)
- `pr_url`, `pr_number`

If `.pr-info.json` is missing → "No Notion task linked to this change. Skipping." STOP.

### 3. Resolve the task page

- If `notion_task_url` is non-empty → extract page ID from it.
- Else if `notion_task_id` looks like a 32-char hex (with or without dashes) → use as page ID directly.
- Else (bare task code like `YSH-48`) → use `mcp__claude_ai_Notion__notion-search` with the code as query, pick the first matching page. If none → STOP.

Use `mcp__claude_ai_Notion__notion-fetch` on the resolved ID to confirm the page exists and read its current body. Capture the URL from the fetch result for later use.

### 4. Read change artifacts

From `openspec/changes/archive/<selected>/`:
- `proposal.md` (Why, What)
- `tasks.md` (completed `- [x]` and remaining `- [ ]`)
- `design.md` (Decisions, File Plan, Open Questions — if present)
- `specs/` (delta specs — note which capabilities)

### 5. Collect git info

```bash
change_short=$(echo "<selected>" | sed 's/^[0-9-]*-//')
git log --oneline --all --grep="$change_short" | head -20
```

Also derive changed files:
```bash
git diff --name-status <merge-base> change/<change_short> 2>/dev/null | head -50
```

If the branch is gone (already merged + deleted), use the commits found above with `git show --stat`.

### 6. Build the 7-section task card body

```markdown
## 背景 / 為什麼做
<one paragraph from proposal.md "Why">

## 做了什麼（變更摘要）
<bulleted list, high-level — derived from tasks.md `- [x]` items, grouped by feature/section>

## 涉及檔案 / 模組
<bulleted list of changed files (path + one-line purpose), from git diff or design.md File Plan>

## 測試 / 驗證方式
<test/lint/typecheck commands that were run, with PASS/FAIL. Pull from conversation context if same session; otherwise state "驗證紀錄請見 PR description / commit log">

## PR / Commit
- PR: <pr_url>
- Branch: `change/<change-name>`
- Key commits:
  - `<sha> <subject>`
  - ...

## 後續 / 待追蹤
<unchecked items from tasks.md, or "Open Questions" from design.md, or "無" if none>

## 沉澱到知識庫的點
<filled in step 8 — leave as "（無）" placeholder for now>
```

### 7. Update the task card

Use `mcp__claude_ai_Notion__notion-update-page` on the task page with the 7 sections above.

**Idempotency strategy**:
- If the page already contains H2 headings matching any of the 7 section names → replace those sections' content (keep the heading order as defined above).
- If the page is empty or has unrelated content (e.g., original task description) → **append** the 7 sections after existing content. Do NOT delete what's there — the user may have written context above.
- Use the Notion patch/replace mechanism appropriate to the MCP tool. Prefer minimal diffs (replace block content, not the whole page).

### 8. Offer to record pitfalls

If pre-flight step 2 found `~/.claude/rules/notion-pitfalls.md` missing → skip directly to step 10 (pitfall logging unavailable; just print one-line note).

Otherwise use **AskUserQuestion**:
```
這次有沒有踩到的坑值得記錄？
  A) 有，建立紀錄
  B) 沒有，跳過
```

If `B` → jump to step 10.

If `A`, repeat the following until user says "no more":

**a. Gather pitfall content** — use **AskUserQuestion** (open input) for each:
- Title slug (will become `YYYY-MM-DD-<slug>` automatically; use today's date)
- 症狀（會看到什麼錯誤 / 行為）
- 根因
- 解法 / 規避方式

User describes from memory / current conversation context. Do not auto-collect from any local file — that would balloon context.

**b. Pick Project label** — use **AskUserQuestion**:
```
這個坑屬於：
  A) <project_slug>（本專案）
  B) global（跨專案的環境/工具問題）
  C) 其他已存在的 slug — 用 AskUserQuestion 開放輸入
```

If user chooses a slug not yet in the database's Project select options:
1. Try `mcp__claude_ai_Notion__notion-update-data-source` to register it.
2. If that fails, fall back to `<project_slug>` and warn user to fix manually.

**c. Optional tags** — use **AskUserQuestion** (open input, may be empty):
> "Tags（多選，逗號分隔，例如 docker,env。可留空）"

For each tag not in the database's Tags multi-select options, register via `notion-update-data-source`.

**d. Create the pitfall page** — use `mcp__claude_ai_Notion__notion-create-pages` with:
- Parent: pitfall database (from `~/.claude/rules/notion-pitfalls.md`)
- Properties:
  - `Title`: `<YYYY-MM-DD>-<title-slug>`
  - `Project`: chosen slug
  - `Tags`: chosen tags (or empty)
  - `Related Task`: `<notion_task_url>` from `.pr-info.json` (or resolved URL from step 3)
- Body:
  ```markdown
  **症狀**
  <user input>

  **根因**
  <user input>

  **解法 / 規避方式**
  <user input>

  **相關任務卡**
  <notion_task_url>
  ```

Capture the new page URL from the create result.

### 9. Backfill task card's "沉澱到知識庫的點"

If any pitfall pages were created in step 8, update the task card's `## 沉澱到知識庫的點` section with bullet links:

```markdown
## 沉澱到知識庫的點
- [<YYYY-MM-DD>-<title-slug>](<pitfall page URL>)
- ...
```

Use `notion-update-page` again, replacing only that section.

### 10. Output

```
## Notion Task Card Updated

**Change**: <change-name>
**Task card**: <task page URL>
**Sections updated**: 背景 / 變更摘要 / 涉及檔案 / 測試 / PR / 後續 / 沉澱
**Pitfalls recorded**: <count> (<comma-separated titles>) or "none"

If anything looks off, edit the page directly in Notion.
```

---

## Guardrails

- Never auto-trigger — only run when user explicitly asks
- If Notion MCP is unavailable, report failure and STOP — don't try alternative output
- Don't modify the archived change files
- Don't create pitfall pages without explicit user confirmation per pitfall
- If task page can't be resolved, STOP — don't create a new page
- Keep `## 沉澱到知識庫的點` section as `（無）` if no pitfalls were recorded
- If `.claude/opsxp.json` doesn't exist, refuse to run and direct user to `/opsxp-setup`
