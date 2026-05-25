## Context

The eval-ui finance-blind-eval app has gone through two major profile schema migrations already. The current shape (post `refine-survey-copy-and-facets`) is a 13-field expanded profile, and the codebase carries a substantial backward-compatibility layer specifically to handle reads of records persisted under the previous schema — including:

- `migrateLegacyProfile` (read-side normalizer that strips 4 legacy keys and remaps `under_20` ageRange)
- `extractLegacyProfileSnapshot` (preserves legacy values in JSON/CSV exports)
- `LegacyProfileSnapshot` type + `LEGACY_FIELDS` constant
- `isLegacyShape` predicate in `app/api/session/route.ts` that detects whether a re-prompt is needed
- `wasLegacy` branch that fires `upsertParticipantStatusAndClearPending` (an atomic helper combining profile upsert + pending-question clear in one mutex window) only on legacy → new transitions
- JSON export attaches a nested `legacyProfile` block to records that originated under the old schema
- CSV export emits 4 trailing `legacy_*` columns (always in the header, empty for new-shape rows)
- Admin drawer renders legacy fields with a `legacy` prefix

The 2026-05-20 advisor meeting concluded that the questionnaire should collect only 5 background dimensions, and the `.data/evaluation-store.json` contains zero real samples (15 entries, all test tokens like `A013`, numeric tokens). The advisor and the user both signed off on a hard schema break with data wipe — there is no production cohort to preserve.

This change replaces the 13-field schema with a 5-field schema and deletes the entire backward-compatibility layer. It is a sibling to `align-advisor-feedback-copy-and-prompt` (2A, just merged), which adjusted intro copy + provider system prompt + 5-question completion gate. 2B operates on a completely orthogonal capability surface (participant profile collection + admin reporting of background distribution).

## Goals / Non-Goals

**Goals:**

- Replace `ParticipantProfile` with a 5-field schema (age range, education level, main domain, AI usage frequency, has-used-AI-for-finance) that mirrors the advisor's stated stratification axes.
- Delete every line of legacy-compat code so the codebase has one schema, one validator, one form, one set of CSV columns. No conditional branches keyed on schema shape.
- Rename `financeBackgroundType` → `mainDomain` and `llmExperience` → `aiUsageFrequency` so field names reflect the new semantics and don't mislead readers of the code or CSV.
- Tighten enums: remove every `prefer_not_to_say` option (5 fields × all required, no opt-out). Reduce `ageRange` from 5→4 options, `educationLevel` from 4→3, `mainDomain` (was `financeBackgroundType`) from 5→3, `aiUsageFrequency` (was `llmExperience`) from 5→4.
- Wipe `.data/evaluation-store.json` so no legacy-shape record ever needs to be read by the new code.
- Keep `.data/platform-settings.json` untouched — 2A's intro copy + system prompt edits live there.
- Maintain spec hygiene: 4 BREAKING-MODIFIED requirements with no requirement-level additions or removals.
- Achieve scope cleanup as a sibling to 2A so the questionnaire that goes live on Zeabur is in its final advisor-approved form.

**Non-Goals:**

- Not changing the intro copy, system prompt, or completion gate (2A already covers those).
- Not adding RAG, real-time data access, or any new model-side capability.
- Not building a migration path from the 13-field schema. Wipe is intentional and final.
- Not preserving the optional `gradeOrOccupation` free-text — advisor removed this field.
- Not introducing a `notes` field of any form on the participant side (the per-question reason fields cover qualitative feedback).
- Not touching the admin invite/QR flow, provider settings UI, prompt category editor, or any other admin tab not directly affected by the profile schema swap.
- Not adding any new requirement to the spec — every change is a MODIFIED of one of the 4 affected requirements.

## Decisions

### D1: Replace, don't migrate

We delete `migrateLegacyProfile`, `extractLegacyProfileSnapshot`, `LegacyProfileSnapshot`, `LEGACY_FIELDS`, the read-time profile migration in storage, the JSON export `legacyProfile` block, the CSV `legacy_*` trailing columns, the `isLegacyShape` predicate, the `wasLegacy` transition branch, and the legacy-only `upsertParticipantStatusAndClearPending` helper. The store is wiped on deploy.

**Alternatives considered:**
- *Add a second migration layer that maps 13-field → 5-field*. Rejected — adds another lifetime of legacy code on top of one we want to remove. Zero real samples means zero savings.
- *Keep the legacy export columns "for future analysis"*. Rejected — once the active fields shrink to 5, the legacy columns no longer have correlated active-profile values; they would be analytically useless and only add noise to admin CSVs.

**Rationale**: The legacy code was justified when a previous deploy had real samples that needed to remain analyzable. After 2A's user-confirmed wipe approval, that justification disappears. Carrying the layer forward would mean every future profile change needs to double-handle both schemas indefinitely.

### D2: Rename two fields to match new semantics

`financeBackgroundType` → `mainDomain`. The old name described "how this participant interfaces with finance (as student/worker, related/unrelated)" — a 2D classification that no longer applies after merging into 3 buckets keyed only on current primary domain. `mainDomain` reads correctly with the 3 new buckets.

`llmExperience` → `aiUsageFrequency`. The old name talked about "experience" with "LLM"; the new enum is purely a usage-frequency stratifier with `never / occasional / frequent / daily`, and the participant-facing label uses "AI" not "LLM" (per advisor: the participant should think of "AI 工具" — ChatGPT/Claude/Gemini).

**Alternatives considered:**
- *Keep old field names, just swap enum values*. Rejected — reduces mechanical churn but leaves misleading names in the type system, CSV headers, admin display, and spec text. The cleanup value of fresh names outweighs the ~30 callsite renames (mostly grep-replaceable).

**Rationale**: Schema name changes are cheap at the size of this codebase and pay dividends every time a future reader skims the types or the CSV.

### D3: No `prefer_not_to_say` on any field

All 5 fields are required, no opt-out. Validation rejects null on each. The participant must explicitly answer all 5 to proceed. (The advisor's view in the 0520 meeting: with only 5 questions and the analysis goal being to compare across declared backgrounds, an opt-out path defeats the purpose.)

**Alternatives considered:**
- *Keep `prefer_not_to_say` on `ageRange` only*. Rejected — even age is a research-relevant dimension; allowing opt-out introduces an extra bucket the analysis would have to either drop or treat as a separate cohort with N too small to matter.

**Rationale**: With N ≈ 20-30 participants and 5-question questionnaire, every bucket that gets created from opt-outs is destructively small. Removing the option simplifies analysis and matches advisor intent.

### D4: Wipe `.data/evaluation-store.json`, leave `.data/platform-settings.json`

User explicitly confirmed wipe is OK (no real samples). The platform-settings file is left alone because 2A's intro paragraphs / signature / system prompt edits are persisted there, and we don't want this change to revert 2A's runtime effects.

**Mechanism**: a task in tasks.md instructs the developer (or a follow-up deploy step) to delete `web/.data/evaluation-store.json`. On Zeabur, the equivalent is a manual file delete inside the mounted volume, or a future admin endpoint. The change does NOT auto-wipe at app start — that would be dangerous if accidentally shipped to a future real cohort.

**Alternatives considered:**
- *Build a `POST /api/admin/reset-data` endpoint as part of this change*. Rejected — out of scope and adds a destructive endpoint that needs careful auth scoping. The manual delete is fine for this deploy.
- *Auto-wipe on first boot when schema mismatch detected*. Rejected — too magic, easy to misfire later.

### D5: Drop `tests/profile-typecheck.ts`, fold checks into `verify-profile-validation.ts`

`tests/profile-typecheck.ts` is a type-only file that asserts `migrateLegacyProfile`'s signature, enum exhaustiveness across removed enums (`Gender`, `FinanceBackgroundType`, etc.), and the legacy raw shape. Everything it asserts is being removed by this change. Re-purposing the file to assert the new schema would be confusing because (a) the new schema is already covered by `tsc --noEmit` across the production code, (b) `verify-profile-validation.ts` already runs through `tsc` as part of `npm run verify:profile` so its compile-time correctness is enforced.

**Alternatives considered:**
- *Rewrite typecheck file to assert new enum exhaustiveness*. Rejected — the value-add is minimal because the codebase has very few sites that exhaustively switch on these enums, and `tsc` will catch any deviation.

**Rationale**: One file deleted, one file rewritten. Lower file count, single source of truth for profile shape assertions.

### D6: KPI bar drops to 3 buckets, no `unknown` bucket

With the data wipe + no legacy compat code, there is no way for a participant row to arrive without `mainDomain` populated (validation rejects null, server rejects incomplete profile). The 4th `unknown` bucket would be dead code on day one. Drop it.

**Alternatives considered:**
- *Keep `unknownCount` defensively in case someone hand-edits the JSON file*. Rejected — premature defensiveness; we'd be writing code for a problem we don't have. If a future bug introduces unknowns, an admin would notice (totals wouldn't add up to participant count) and we'd add the bucket back then.

**Rationale**: YAGNI — only ship what the data shape demands.

### D7: Spec changes are MODIFIED-only, no ADDED, no REMOVED

The 4 affected requirements (`Participant background form`, `Evaluation record storage`, `Admin evaluation dashboard`, `Data export`) all retain their identity and high-level purpose. Their *scenarios* change a lot — many legacy scenarios disappear, new field-required scenarios appear — but the requirements themselves are about the same capability surface (background form, record storage, admin dashboard, data export). Keeping them as MODIFIED minimizes spec disturbance and makes the diff readable.

**Alternatives considered:**
- *REMOVE the legacy-handling scenarios as separate requirement removals*. Rejected — they're not their own requirements; they live as scenarios under the 4 capability requirements above.
- *ADD a new requirement "Profile schema version 2"*. Rejected — there is no separate capability; the schema IS the requirement.

**Rationale**: Faithful to the OpenSpec model where Requirements are capability statements and Scenarios are observable behaviors within them.

## Risks / Trade-offs

- **Risk**: A developer reading the merged spec might miss that legacy is gone and try to add a back-compat shim later when adding a 3rd schema version. **Mitigation**: The spec text in `Participant background form` is rewritten to state the schema explicitly and the proposal/design files (archived) document the legacy-removal decision.

- **Risk**: After deploy, an admin who restored a backup of the old `.data/evaluation-store.json` would crash the app (records would deserialize but `mainDomain` would be undefined, KPI bar calc would NaN). **Mitigation**: Document in deploy notes (added to the same admin reset step from 2A's deferred deployment tasks) that the store must start empty after this change. Add a startup-time log warning if a participant row lacks `mainDomain` (low priority, not in this change).

- **Risk**: The full rewrite of `profile-form.tsx` could regress accessibility or styling. **Mitigation**: The new form has fewer fields, same UI primitives (`<select>` + `<label>`), same Button component. Verify visually after apply.

- **Risk**: Removing `upsertParticipantStatusAndClearPending` might be needed for some non-legacy race we haven't thought of. **Mitigation**: Audit callsites — it's called from one place (`session/route.ts`) and only on the `wasLegacy` path. Without legacy, the path is dead. Confirmed.

- **Trade-off**: Smaller schema gives weaker stratification power. **Acceptance**: Advisor explicitly approved; the alternative (richer stratification) was tested in the previous version and judged too long for the 5-question questionnaire.

- **Trade-off**: Wiping `.data` means losing test artifacts the user may have inspected. **Acceptance**: User explicitly approved; tests can be re-created in seconds via the seeded participant flow.

## Migration Plan

1. **Local** (during apply): the developer applies the change on `change/simplify-participant-profile-to-5-fields`, runs `npm run verify:profile`, `npm run lint`, `npm run typecheck`, `npm run build`. Manual `rm web/.data/evaluation-store.json` step is logged in `tasks.md` (so we don't accidentally commit a wiped file).

2. **PR review & merge**: standard PR to `main`, archive on merge.

3. **Deploy to Zeabur**: bundled with 2A's deferred deployment (`align-advisor-feedback-copy-and-prompt` tasks 5.5-5.8). Steps:
   - Push 2A + 2B merged main to Zeabur via `npx zeabur@latest deploy --service-id 6a06c9fdeb6e67d8262aba62`.
   - On the Zeabur container's mounted `/src/.data` volume, delete `evaluation-store.json` so the new code starts with an empty store. Leave `platform-settings.json` alone.
   - Open `/admin`. If a banner appears about settings format incompatibility, run `POST /api/admin/settings/reset` (from 2A deploy notes).
   - Smoke-test: redeem invite → 5-field form renders correctly → submit → reach question flow → answer all 5 → reach completion screen.
   - Smoke-test non-finance refusal: ask the chat with `"今天台北天氣"` to confirm 2A's system prompt enforces finance-brain refusal.

4. **Rollback**: revert the merge commit on main, re-deploy. No data migration concern (the wipe was the only stateful action and the old store is no longer needed).

## Open Questions

None blocking. All field naming, enum values, scope cuts, and spec change types were locked in during the explore Clarity Check (overall 4.7).
