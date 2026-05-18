## Context

This is the second pre-launch copy/UX pass on the participant background form, following `refine-participant-profile-fields` (archived 2026-05-18). The form is functionally complete and validated end-to-end; this pass tightens copy and reduces facet judgment load before the first real participant batch.

Constraint: the prior change introduced a `migrateLegacyProfile` reader-side normalizer plus an atomic `upsertParticipantStatusAndClearPending` helper to ride out schema transitions. Both must remain compatible with stored data that may still have `educationLevel: "high_school_or_below"` (impossible in practice given the 20-24 minimum but the reader must degrade gracefully).

## Goals / Non-Goals

**Goals:**
- Remove visually redundant copy from the profile form without changing its schema.
- Tighten the education option set to the live recruiting range.
- Replace the visually inconsistent Y/N radio with the same `<select>` pattern used elsewhere on the form.
- Drop the `reasoning` facet across types, config, server, admin, and exports — fully decommission, not just hide.
- Drop the redundant 金融 prefix on the correctness facet label.

**Non-Goals:**
- No new fields, no new validation rules, no questionnaire-flow changes.
- No data migration: stored `.data/evaluation-store.json` is left intact. Historical records' `facetSelections.reasoning` becomes dead JSON.
- No participant-facing language change beyond the two label edits explicitly listed.
- No change to the landing-page study intro (the `study.intro.paragraphs` in config).

## Decisions

### D1: Soft-remove vs hard-remove for `reasoning` facet

**Decision**: Hard-remove from the type union, config, and CSV columns. Leave historical JSON keys untouched.

**Why over alternatives**:
- *Soft-remove* (keep `reasoning` in the type union but exclude it from `evaluationFacets` at runtime) → leaves a dead type member that every future facet-touching change has to reason about. Cost-bearing, no benefit since the facet is not coming back.
- *Hard-remove + migrate historical records* → unnecessary write to disk for 5 dev-test records. Adds risk during the rollout for zero analytical benefit (`reasoning` data was never analyzed).

The chosen path is the smallest forward delta: code stops surfacing `reasoning`; old JSON entries become benign.

### D2: Education option removal via narrowing the union

**Decision**: Remove `"high_school_or_below"` from the `EducationLevel` union, the option list, and the validator's allowed set. `migrateLegacyProfile` already routes invalid education values to undefined (via `hasChoice`), so a hypothetical stored profile with the removed value will be treated as missing and re-prompted via `isLegacyShape` — same well-tested code path as the original migration.

### D3: Y/N input — `<select>` with placeholder, mirroring existing pattern

**Decision**: Use `<select>` with three `<option>` entries: a disabled placeholder (`""` value, `disabled` attribute), `"true"` (是), `"false"` (否). Cast event.target.value to boolean in the change handler. Store `hasUsedAiForFinance: null` when placeholder is selected, matching the tri-state draft convention.

**Why over alternatives**:
- *Tighter radio*: would require new CSS class. Adds maintenance surface for a one-off. Inconsistent with all other Y/N-style fields on this form.
- *Custom toggle*: over-engineered for one binary question.

The select approach reuses the exact pattern of `gender` / `educationLevel` / `financeBackgroundType` — same disabled-placeholder + `null`-on-empty + tri-state validation behavior.

### D4: Correctness facet label rename — config-only

**Decision**: Change `"金融正確性最好"` → `"正確性最好"` in `evaluation.config.json` only. No code reference. The label flows through `evaluationFacets` straight to the UI.

### D5: Persisted records keep `reasoning` JSON; no cleanup pass

**Decision**: Do not write a one-shot script to strip `facetSelections.reasoning` from the 5 historical dev-test records. They will be re-reset before launch as part of normal pre-launch hygiene (separate from this change). Spec requirement around persisted record shape uses "SHALL store ... facet-best labels for correctness, completeness, and readability" — the absence of `reasoning` keys from new records satisfies this; the presence of stale keys on old records does not violate it (the spec doesn't forbid extra keys).

## Risks / Trade-offs

- **[Risk] Removing a facet column from CSV breaks an in-flight downstream pipeline** → Mitigation: nothing downstream exists yet (pre-launch). The `BREAKING` flag in the proposal signals to future readers.
- **[Risk] `platform-settings` validation rejects runtime-loaded configs that still list `reasoning` as a facet id** → Mitigation: the only platform settings on disk is the in-repo `evaluation.config.json` which we are editing in this same change. No external runtime settings yet exist.
- **[Risk] A reader of this PR confuses `reasoning` removal with a deeper analytical decision** → Mitigation: proposal makes the rationale explicit (N=30-40 marginal info, redundancy with correctness).

## Migration Plan

Forward-only, no rollback step required:
1. Land the change behind a single PR.
2. Pre-launch hygiene step (out of scope here) wipes `.data/evaluation-store.json` before opening to participants.

## Open Questions

(none)
