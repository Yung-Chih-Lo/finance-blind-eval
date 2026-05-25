## Context

After 2A (`align-advisor-feedback-copy-and-prompt`) and 2B (`simplify-participant-profile-to-5-fields`) merged, a fresh grep on `main` shows that the 0520 advisor policy "受測者不該看到盲測/H1/H2/APT 等技術術語" is **still violated in 8 user-visible places** — none of which are in the intro paragraphs that 2A scrubbed.

The reason is structural: 2A's spec requirement `Participant intro neutral terminology` is named "intro" and its scenarios only pin `study.intro.paragraphs` (plus `study.signature.thesisTitle` via a separate scenario). The verify guard literally only joins `intro.greeting + paragraphs + tasks`. So everything outside that narrow band — page header, browser tab title, completion screen, the entry caption shown right after invite redeem, the button label seen at the profile→questions transition — could keep the jargon and still pass verify.

This change closes that gap. It is purely a copy + verify + spec scoping fix. No new feature, no behavior change, no data migration. Sibling to 2A semantically, but separated because 2A had to ship first (it was the larger change with the system prompt + completion gate work).

## Goals / Non-Goals

**Goals:**

- Replace every participant-visible `盲測` / `Blind` string with neutral terminology aligned to 2A's `金融腦` framing (so title / button / completion read consistently with the system prompt and intro paragraphs).
- Tighten `Participant intro neutral terminology` so future copy edits in the same surfaces fail verify rather than slipping through.
- Cover *component-level* strings (which live in `.tsx` source, not config) via a `fs.readFileSync` grep-based test — config-only verify can't catch these.
- Document the post-deploy `.data/evaluation-store.json` wipe step in `CLAUDE.md` (currently lives only in archived 2B tasks.md, easy to miss on a future re-deploy).
- Bring `README.zh-TW.md` + `docs/USAGE.zh-TW.md` in line with the post-2A/2B reality (drop jargon, drop references to deleted profile fields).

**Non-Goals:**

- Not changing the admin-only `"盲測資料後台"` string in `web/app/admin/page.tsx:323` — researcher-facing, technical term is appropriate.
- Not refactoring how the participant components are structured. Pure string replacement.
- Not modifying any spec scenario added by 2A / 2B. The `Participant intro neutral terminology` MODIFIED preserves the 3 existing scenarios verbatim.
- Not adding admin-side guard rails (e.g. preventing an admin from typing `盲測` back into the `問卷文案` tab). The runtime override path is admin-trusted; the change pins only the *default* shipped config plus the participant components.
- Not addressing the UX micro-issues flagged in the 2B verify multi-perspective review (cross-disciplinary `mainDomain` bucketing, AI usage frequency `~once a week` gap). Those wait for real participant feedback.

## Decisions

### D1: Use `金融腦回答比較研究` as the new study title

Aligns with the `金融腦` framing already established in 2A's `DEFAULT_SYSTEM_PROMPT` and required by `verify-intro-copy.ts`'s `REQUIRED_FRAMING_KEYWORDS = ["金融語言模型", "金融腦"]`. Reads as a complete research-context phrase ("金融腦的回答比較研究") rather than a clinical "blind test of model answers" — matches what the advisor said in the 0520 transcript when they emphasized referring to the model as `金融腦` to participants.

**Alternatives considered:**
- *`金融問答品質研究`* — research framing but loses the `金融腦` continuity. Rejected.
- *`金融專業回答問卷`* — keeps `專業回答` from the old title, just drops `盲測`. Smaller diff but doesn't lean on the system-prompt branding.
- *`金融問答比較研究`* (without `金融腦`) — neutral but doesn't reinforce the participant-facing branding `金融腦` used elsewhere.

### D2: Drop the English `Blind Model Evaluation` eyebrow

`study.eyebrow` shows as a small caption above the page header. The English `Blind` literally translates to `盲測`, defeating the purpose. Replacing with `金融問答比較研究` (Chinese, mirroring the new title at a slightly less specific level — `金融問答` instead of `金融腦回答`) keeps the eyebrow as a research caption without re-introducing English jargon.

**Alternative:** Keep an English eyebrow with neutral phrasing (e.g. `Finance Answer Comparison Study`). Rejected because the entire participant flow is in Traditional Chinese — a single English caption sticks out and offers no usability value to the Taiwan-based participant base.

### D3: Add a component-source grep test, not just a config grep

The 2A verify approach (joining config string fields and asserting forbidden words) cannot reach `.tsx` source — the entry page caption and the submit button label live in JSX. A component-source grep via `fs.readFileSync(path).includes("盲測")` is the simplest cross-file guard. The test reads exactly 3 known component files; not a recursive grep, because we want the scope explicit and predictable.

**Trade-off:** A future component that introduces participant copy with jargon won't be caught until the file is added to the test's hard-coded list. Acceptable for this codebase size (single `web/components/evaluation/` directory, all participant components live there). The discoverability is a known limitation, not a hidden trap — the test's comment will say which files it scans.

**Alternative:** Recursive grep across `web/components/evaluation/`. Rejected because:
1. The directory may add admin-only or shared components in future and we don't want the test to fail on legitimate uses of `盲測` in researcher-facing files.
2. Path explicitness makes test failures actionable ("X file has jargon" vs "somewhere in this directory").

### D4: Pin both `"盲測"` and `"Blind "` (with trailing space)

Trailing space on `Blind ` avoids false positives on English words that contain `Blind` as a prefix in legitimate participant-facing contexts (`Blinded`, `Blinder`, etc.). The participant-side strings are Chinese-dominant; the only `Blind` token at the surface is the freestanding word in `study.eyebrow`. Pinning the exact word with boundary keeps the test precise.

**Alternative:** Regex word-boundary check `\bBlind\b`. Functionally equivalent for current surface but adds regex complexity. The trailing-space heuristic is good enough for the 1 English occurrence we're tracking.

### D5: Spec scope is MODIFIED, not split into 3 new requirements

The advisor's policy is one capability — "participant-facing copy avoids researcher jargon". Wrapping it in three separate requirements would fragment the policy across the spec when in practice it's "the same rule applied at more surfaces". A single MODIFIED requirement with the new scenarios appended keeps the spec readable and matches how 2A originally framed it.

**Alternative:** New requirement `Participant title and completion neutral terminology`. Rejected as artificially separating the same policy.

### D6: Don't auto-wipe runtime overrides on deploy

If an admin previously edited the study title via the `問卷文案` tab to a custom value, `web/.data/platform-settings.json` carries that override and the runtime UI reads the override, NOT the new default. This change does NOT force a settings reset to push the new default through. The migration note in `CLAUDE.md` tells the admin to check `/admin → 問卷文案` after deploy and update overridden strings manually if any are stale.

**Rationale:** Force-clearing platform-settings.json would also wipe 2A's intro paragraphs and system prompt if the admin had edited those — high blast radius. Manual reset is safer; the cost is one extra dashboard check.

### D7: Migration note location

`CLAUDE.md`'s `### Volume Mount` section already documents the `/src/.data` volume contents (`evaluation-store.json` + `platform-settings.json`). The new migration note goes directly under that block so it's discovered by anyone reading volume operations. Placement matters — the existing `**Migration note**` about `provider-api-base-url` lives in `### Env Vars`, which is the wrong place for a data-wipe instruction.

## Risks / Trade-offs

- **Risk**: An admin reads the new copy in `/admin → 問卷文案` after deploy and dislikes the wording. **Mitigation**: All 5 config strings are admin-editable at runtime via the existing `問卷文案` tab; admin can override without touching code. The change does not lock the wording.

- **Risk**: A future component (e.g. a new participant-facing settings page) introduces `盲測` and `testComponentStringsAvoidJargon()` doesn't notice because the new file isn't in its hard-coded list. **Mitigation**: documented as a known limitation in the test's comment. A future change adding a new participant component should also add the file to the test list — this is the same maintenance pattern as 2A's verify scripts.

- **Risk**: `study.title` now uses `金融腦`, which `verify-intro-copy.ts` lists in `REQUIRED_FRAMING_KEYWORDS`. After expanding `visibleText` to include `study.title`, the "must include 金融語言模型 or 金融腦" assertion still holds — but now via `title`, not via `paragraphs`. If a future copy edit removes `金融腦` from both, the assertion fails as designed. **Acceptance**: this is the intended behavior; the assertion was always about the union of visible text.

- **Trade-off**: The 5 new config strings make the diff for `evaluation.config.json` larger than strictly necessary if the goal was "just remove 盲測". We took the opportunity to rewrite `completion.description` more comprehensively (`為了避免影響後續研究分析的客觀性...`) rather than do a 1-character delete. **Acceptance**: the original sentence's structure had `為了維持研究盲測設計` as its causal clause — removing only the word leaves a grammatically awkward stub. Full sentence rewrite is more participant-friendly.

- **Trade-off**: The docs sync (`README.zh-TW.md`, `docs/USAGE.zh-TW.md`) touches files outside `web/`. They've drifted from the codebase across 2A and 2B and the line 119 stale-field reference was easy to find via grep. Including them keeps documentation honest. **Acceptance**: adds maybe 10 lines to the diff; pays for itself the next time someone reads USAGE.

## Migration Plan

1. **Local apply** (during this change): rewrite verify guard (RED → expect FAIL because config still has `盲測`) → fix the 5 config strings + 3 component strings (GREEN) → docs sync → run full verify + lint + typecheck + build.

2. **PR review & merge**: standard PR to `main` via `gh pr create`; archive on merge.

3. **Deploy to Zeabur**: rolls together with any other queued work or as a standalone deploy. The Zeabur build will pick up the new `evaluation.config.json` defaults; runtime overrides in `platform-settings.json` (if any) take precedence.

4. **Post-deploy admin check** (manual, ~30 seconds): open `/admin → 問卷文案`. Confirm the rendered title field shows `金融腦回答比較研究` (default) — if it shows something with `盲測` still, the admin had previously overridden the field at runtime; click into the field and update to the new copy.

5. **Rollback**: revert the merge commit. No data migration, no schema impact, no env var change.

## Open Questions

None blocking. All 8 string replacements were locked during explore. The `金融腦回答比較研究` title was user-chosen with the cascade defaults reviewed. Component grep file list (3 files) is pinned to the participant flow surface as it stands today.
