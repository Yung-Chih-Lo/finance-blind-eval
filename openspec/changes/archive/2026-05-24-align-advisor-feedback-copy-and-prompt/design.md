## Context

The 2026-05-20 advisor meeting flagged three categories of problems in the live deployment (`https://finance-blind-eval.zeabur.app`) that block the agreed `下週試玩` validation pass: (1) participant-facing intro leaks researcher terminology including the APT thesis title in the signature block, (2) `DEFAULT_SYSTEM_PROMPT` is a single neutral sentence with no `金融腦` scope enforcement so non-finance / real-time questions get answered, (3) the spec does not enforce a 5-question completion gate so participant records of varying length are accepted as `valid`.

This change ships the narrow advisor-facing fixes that can be deployed within 1-2 hours. The much larger `ParticipantProfile` schema rewrite (13 → 5 fields), `.data` reset, and removal of the 2026-05-18 legacy mechanism are deferred to a separate change so that fix can be tested independently and the advisor demo is not gated on it.

5/30 Shenzhen workshop submission is the hard deadline. Advisor explicitly asked for a working version to test within the same week as the meeting.

## Goals / Non-Goals

**Goals:**

- Replace participant-facing intro / signature copy with the codex-style four-paragraph neutral version (verified against transcript — removes `大型語言模型`, `主要分層變項`, APT exposure).
- Replace `DEFAULT_SYSTEM_PROMPT` with a `金融腦` definition that enforces finance-only scope, refuses real-time / external-tool queries, declines specific buy/sell advice, forbids leaking model name / blind labels.
- Add server-side enforcement that participants cannot transition to `completionStatus = "completed"` before answering exactly 5 questions.
- Add spec scenarios that pin the above three behaviors so future drifts are caught at verify-time.

**Non-Goals:**

- Profile schema rewrite (deferred to change `2B` — `simplify-participant-profile-to-5-fields`).
- Resetting `.data` (gated by `2B`).
- Removing the `migrateLegacyProfile / legacy_* CSV columns / legacyProfile JSON block / legacy form re-prompt` mechanism added on 2026-05-18 (gated by `2B`).
- RAG integration — advisor said `這也是未來`. Will be referenced in the thesis as future work; this change leaves the system prompt as the only finance-brain enforcement layer.
- Changing the `promptCategories` array, the 25 example questions, or the `{{categoryTitle}} / {{categoryInstruction}}` template variables — admin already has a study-copy editor to flatten these manually if desired.
- Adding an in-app `已完成 N/5 題` confirmation step before the completion cookie sets — the existing `Completion cookie issuance` requirement already fires the cookie automatically when `completionStatus` becomes `"completed"`; this change only tightens the boolean.

## Decisions

### D1: System prompt remains a hardcoded default with admin-editable override (not "admin must configure first")

The proposal could have demanded admin explicitly fill in the system prompt before answer generation works (treating an empty default as a hard validation error). Rejected because:

- Advisor needs the system to "just work" when he opens the URL in step 1 of his demo; a config-error wall would be a worse UX than an over-eager prompt.
- The `Provider settings invalid` scenario in `Server-mediated model answer generation` already covers the legitimate empty-prompt case (`!settings.systemPrompt.trim()` issues a validation error in `validateProviderSettings`).
- Keeping a hardcoded default means the new finance-brain copy ships with the deployment instead of being a manual admin step.

Alternative considered: ship the new prompt **only** in `evaluation.config.json` as runtime settings seed, leaving `provider-settings.ts` empty. Rejected — `evaluation.config.json` is study copy, not provider config; mixing them violates the existing separation in `Study copy settings preserve provider behavior`.

### D2: Same finance-brain system prompt applies to all three internal model IDs

`provider-settings.ts` already keeps a single `systemPrompt` field used for every model in the gateway call. We deliberately do NOT introduce per-model prompts in this change because:

- Differential system prompts would introduce a confound — any A/B/C preference difference could be attributed to prompt design rather than the underlying APT vs baseline training.
- Advisor wants the comparison to isolate the training-method effect, not the prompt-engineering effect.
- The base TAIDE model may follow instructions worse than the APT-trained H1/H2, which is itself a finding worth observing (advisor: `即使模型誤判金融問題,這種錯誤回應也可作為評估數據`).

### D3: Completion gate is enforced server-side in `evaluation-storage.ts`, not in the participant UI

Client-side `disable button until N=5` cannot be trusted — a participant who refreshes after question 3 must not be able to mark themselves complete by manipulating local state. The server is the only authoritative point. Specifically, the `completionStatus` transition logic must check `recordsForParticipant.length === 5` before setting `"completed"` and before the `Completion cookie issuance` requirement fires.

Alternative considered: enforce in API route handler before calling storage. Rejected — storage already owns the `completionStatus` derivation; pushing it up adds a second source of truth.

### D4: New `### Requirement:` blocks rather than `MODIFIED` to existing ones

The advisor-asked behaviors do not contradict any existing requirement — they extend coverage. Adding scenarios as new requirements:

- Keeps the delta diff minimal (no copy-paste of full existing requirements).
- Makes the `align-advisor-feedback` lineage easy to trace at archive time.
- Avoids the documented pitfall in the specs instruction: `Using MODIFIED with partial content loses detail at archive time`.

### D5: Existing runtime `platform-settings.json` is NOT auto-migrated to the new default

If the deployed `.data/platform-settings.json` already contains a `systemPrompt` (any value, even the old short default), the new finance-brain default does NOT overwrite it. Reasoning:

- Admin may have edited the system prompt through the study-copy UI; auto-overwriting violates user expectation.
- `Settings version reproducibility` requirement makes already-generated pending questions reference the old `settingsSnapshotHash`; silent overwrite would invalidate that lineage assumption for any record about to be saved.

Migration path: after deploy, advisor (or Yung) opens `/admin`, observes the system prompt field still shows the previous value, and either (a) edits the prompt manually to the new finance-brain version, or (b) calls `POST /api/admin/settings/reset` to drop runtime settings and pick up the new code default. Documented in proposal `Impact` section.

### D6: `signature.thesisTitle` becomes neutral Chinese ("金融語言模型回答品質之研究"), not hidden

User selected option (b) over hiding the field entirely. Reasoning:

- Signature block visually grounds the questionnaire as an academic study, improving participant trust.
- A neutral Chinese title still allows the thesis to be cited at submission without re-exposing APT.
- `study.signature` remains a configurable runtime field — admin can change the title later via the existing study-copy editor.

## Risks / Trade-offs

- **Existing `platform-settings.json` carries old `systemPrompt`** → admin must manually reset or edit. Mitigation: proposal explicitly documents this in `Impact`; verify step will confirm `/admin` view shows the expected value after deployment.

- **Completion-gate race condition**: a participant on two browser tabs racing to submit question 5 could in principle trigger two `completionStatus` transitions. Mitigation: the `Owning participant deletes a pending question` route already serializes per-token writes through file-locked storage; the new check inherits that serialization. Not adding a new lock for this change.

- **Per-model system prompt sharing → TAIDE may follow instructions worse**: the base model may comply less reliably with the finance-brain refusal rule than H1/H2. Mitigation: explicitly a non-goal to fix — observation data. Documented in advisor transcript and design D2.

- **`thesisTitle` neutral wording is not yet final** — user said `暫定，user 之後可再改`. Mitigation: signature is admin-editable; the placeholder is a sensible default and can be tightened in a follow-up without code change.

- **Spec adds 3 new requirements** — slight increase in spec footprint, but each is single-concern and testable. No spec line removed.

## Migration Plan

1. Land this change on `main` via `change/align-advisor-feedback-copy-and-prompt` branch.
2. Redeploy to Zeabur: `cd web && npx zeabur@latest deploy --project-id 69b00f05d00471cc19a0b524 --service-id 6a06c9fdeb6e67d8262aba62 --json`.
3. Open `/admin` on the deployed site. If the legacy provider banner appears, the existing `provider-api-base-url` migration path handles it (untouched by this change).
4. Either (a) call `POST /api/admin/settings/reset` if it is safe to drop all runtime settings — this picks up both new defaults; or (b) edit the system prompt manually in the study-copy editor to the new finance-brain copy.
5. Verify on the participant-facing entry route (`/?invite_code=ailab502`) that intro renders the new four paragraphs and signature shows `金融語言模型回答品質之研究`.
6. Verify by entering a non-finance question (`今天天氣如何`) that all three answer slots return a finance-scope refusal (`抱歉，這個問題不在我的金融問答範圍`).
7. Verify by completing 4 questions and refreshing — completion cookie is NOT set; only after question 5 saves does the completion page render.

**Rollback strategy**: revert the merge commit on `main` and redeploy. No data migration to undo. Admin runtime overrides are preserved.

## Open Questions

- Should the finance-brain default also instruct the model to **not** mention "this is a thesis study" if a participant asks? Current draft says nothing about it. Decision: not in scope — if advisor flags it next round, add to a follow-up change.
- Does the completion gate need a visible `已完成 5 題，本次問卷結束` toast before the redirect to the completion page? Currently the `Completion cookie issuance` flow redirects via the existing `eval_completed` cookie check on next page load. Decision: keep current UX; no toast added.
