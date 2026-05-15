---
name: opsxp-setup
description: Initialize project-specific OpenSpec workflow settings — auto-detect commands, set PR target branch, configure optional Notion integration. Run once per new project, or to refresh settings.
license: MIT
compatibility: "Requires openspec CLI ≥ 1.2.0. Optional: GitHub MCP, Notion MCP."
user-invocable: true
metadata:
  author: openspec-plus
  version: "3.1"
---

Initialize project-specific settings for the OpenSpec workflow. Run this **once** when starting a new project from the template, or re-run to refresh.

This skill produces config files that downstream skills (`opsxp-apply`, `opsxp-verify`, `opsxp-archive`, `opsxp-notion`) read at runtime.

---

## Outputs

| File | Purpose | When |
|---|---|---|
| `.claude/rules/project-commands.md` | batch test/lint/typecheck/build commands | Always |
| `.claude/rules/openspec-git.md` | PR target branch | Always (replaces placeholder) |
| `.claude/opsxp.json` | project-level structured config: `task_integration_enabled`, `project_slug` | Only if Notion enabled |

**User-level config** (`~/.claude/rules/notion-pitfalls.md`) is assumed to already exist — it holds the shared pitfall database URL and is set up once per machine, not per project. If missing, this skill warns but does not block.

**Note**: `.claude/hooks/lint.sh` already handles per-file linting on Edit/Write independently. The batch commands here are for `/opsxp-apply` and `/opsxp-verify` only.

---

## Steps

### 0. OpenSpec version + profile

```bash
openspec --version
```

If version < 1.2.0 → STOP and tell user:
```
OpenSpec ≥ 1.2.0 required for the modern archive flow.
Upgrade: npm install -g @fission-ai/openspec@latest
Then re-run /opsxp-setup.
```

```bash
openspec config list
```

If `profile: custom` (10 workflows):
- Use **AskUserQuestion**: "Switch to minimal `core` profile to reduce skill clutter?"
  - Yes → Run `openspec config profile core` and `openspec update --force`
  - No → keep custom

If permission error on `openspec config`:
- Print: "Run `sudo chown -R $(whoami) ~/.config/openspec` then re-run setup."

---

### 1. Auto-detect batch commands

Read `package.json` and/or `pyproject.toml` (whichever exist). Fill slots **without asking**:

| Slot | Logic |
|---|---|
| test | `package.json` scripts.test → `npm test`; else `pytest` if `pyproject.toml`; else `<not configured>` |
| lint | `package.json` scripts.lint → `npm run lint`; else `ruff check .` if Python; else `<not configured>` |
| typecheck | `package.json` scripts.typecheck → `npm run typecheck`; else `mypy .` if Python; else `<not configured>` |
| build | `package.json` scripts.build → `npm run build`; else `<not configured>` |

Don't confirm each one. The user can edit `project-commands.md` later if a default is wrong.

---

### 2. PR target branch

Use **AskUserQuestion**:
```
PR 要合併到哪個 branch？
  A) main
  B) dev
  C) master
  Other → custom
```

If `openspec-git.md` already has a branch set (not placeholder), use that as the default and ask whether to update.

---

### 3. Notion integration

Use **AskUserQuestion**:
```
啟用 Notion 任務卡整合？
  A) 啟用 — /opsxp-ff 時開 draft PR 並連到 Notion 任務卡；/opsxp-notion 把進度寫回任務卡，並可選擇建立「踩到的坑」紀錄
  B) 不啟用
```

If **B**: skip the rest of step 3. Task Integration is off.

If **A**:

**a. Verify user-level pitfall config**

Read `~/.claude/rules/notion-pitfalls.md`. Required fields: `## Database ID` and `## Database URL`.

If missing or unreadable:
- Print warning: `"~/.claude/rules/notion-pitfalls.md not found. /opsxp-notion will not be able to log pitfalls until it's restored. Continuing setup anyway."`
- Continue — do NOT block setup. The task card writeback half of `/opsxp-notion` still works.

Do **not** ask the user for a database URL — this is a user-level one-time config, not a per-project setting.

**b. Project slug**

Use **AskUserQuestion** (open input):
> "本專案的 Project slug（用來 tag 任務卡 / 踩到的坑，例如 lighf-chat、lighf-web、global）"

Default: derive from `basename "$PWD"` if it looks like kebab-case; otherwise leave blank.

After getting slug, register it in the pitfall database (only if step 7a succeeded — i.e., the user-level file exists):
1. Use `mcp__claude_ai_Notion__notion-fetch` on `collection://<Database ID>` to read current `Project` select options.
2. If slug already present → done.
3. If missing → `mcp__claude_ai_Notion__notion-update-data-source` to add it to the `Project` property's options. Pick any color.
4. If update fails (permission, schema lock, etc.): print warning — `"Could not auto-register slug '<slug>'. Add it manually under the Project property in Notion before running /opsxp-notion."` Do NOT block setup.

---

### 4. GitHub MCP health check

```bash
claude mcp list
```

- ✓ Connected → print "GitHub MCP ready"
- ✗ Failed → print reconnect instructions, continue setup
- Not installed → print install hint, continue setup

**Do NOT block on MCP failure** — `opsxp-archive` has a fallback to compare URL.

---

### 5. Write `.claude/rules/project-commands.md`

```markdown
# Project Commands

Auto-generated by `/opsxp-setup`. Re-run setup to refresh.

## Test
\`\`\`
<test command or <not configured>>
\`\`\`

## Lint
\`\`\`
<lint command>
\`\`\`

## Typecheck
\`\`\`
<typecheck command>
\`\`\`

## Build
\`\`\`
<build command>
\`\`\`

## Stack
- Detected: <Node | Python | Polyglot>
```

Slots marked `<not configured>` are skipped by downstream skills, not errored.

---

### 6. Update `.claude/rules/openspec-git.md`

Read existing file. Replace `**(ASK USER AND MODIFY HERE)**` with `**<chosen branch>**`.

---

### 7. Write `.claude/opsxp.json` (only if Task Integration enabled)

```json
{
  "task_integration_enabled": true,
  "project_slug": "<slug>"
}
```

If Task Integration is disabled, **delete** the file instead of writing it.

**Migration from old format**: If `.claude/rules/notion-config.md` exists (v3.0 format with `Dev Log Parent Page` / `Dev Log Enabled`), read its `Task Integration Enabled` value if present, ask for `Project Slug` if missing, write `.claude/opsxp.json` in the new format, then **delete** the old `notion-config.md` file.

---

### 8. Verify

```bash
ls .claude/rules/
```

---

## Output

```
## Project Setup Complete

**Stack**: <Node | Python | Polyglot>
**PR target branch**: <branch>
**Notion**: <off | on (slug=<slug>)>
**Pitfall DB**: <ready | user-level config missing>
**GitHub MCP**: <ready | failed | not installed>

Ready. Run `/opsxp-explore` to think through your first change, or `/opsxp-ff` if you already know what to build.
```

---

## Idempotency

Re-running is safe:
- Auto-detects commands fresh from `package.json` / `pyproject.toml`
- Reads existing PR branch + `.claude/opsxp.json` to pre-fill defaults
- Never asks for the pitfall DB URL — that's user-level config managed once
- Asks before overwriting non-default values
- If `.claude/rules/notion-config.md` (v3.0 MD format) exists, migrates to `.claude/opsxp.json` and deletes the old file

---

## Guardrails

- Never edit user code or commit
- Never run the test/lint/build commands themselves — only record them
- If `claude mcp list` fails entirely, continue — print warning only
- Do NOT touch `openspec/` directory — that's OpenSpec's territory
