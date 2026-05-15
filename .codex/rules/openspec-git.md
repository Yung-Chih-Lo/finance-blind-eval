# OpenSpec Git Integration

When executing OpenSpec workflows, follow these git integration rules.

## Branch Strategy

- **PR target branch**: **main**
- **Branch naming**: `change/<change-name>` (matches the OpenSpec change name)
- When starting a new change (`/opsxp-ff`), create a feature branch from the current target branch
- When archiving (`/opsxp-archive`), push and create a PR to the target branch above

## Auto-commit During Apply

- **Timing**: After each task is marked `[x]` complete in `/opsxp-apply`
- **Format**: `feat(<change-name>): task <N> - <short task description>`
- **Scope**: Only stage files related to the current task (source + test files)
- Do NOT use `git add -A` — be specific about which files to stage

## PR Creation on Archive

- **Title**: `feat: <change-name>`
- **Body**: Assembled from proposal.md (summary) + tasks.md (completed items) + design.md (key decisions)
- After PR is created, switch back to the target branch
