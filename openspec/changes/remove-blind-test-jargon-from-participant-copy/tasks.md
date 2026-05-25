## File Plan

- **Modify**: `web/scripts/verify-intro-copy.ts` — expand `visibleText` to include `study.title / rootTitle / eyebrow / completion.title / completion.description / completion.notes`; add a new `testComponentStringsAvoidJargon()` that reads 3 component files via `fs.readFileSync` and asserts `"盲測"` + `"Blind "` absent
- **Modify**: `web/config/evaluation.config.json` — 5 string fields: `study.title`, `study.rootTitle`, `study.eyebrow`, `study.completion.title`, `study.completion.description`
- **Modify**: `web/components/evaluation/token-entry.tsx` — single line at ~88 (`"A / B / C 匿名盲測"`)
- **Modify**: `web/components/evaluation/profile-form.tsx` — single line at ~198 (submit button text `"開始 5 題盲測問卷"`)
- **Modify**: `web/components/evaluation/question-flow.tsx` — single line at ~321 (`aria-label="盲測回答比較"`)
- **Modify**: `CLAUDE.md` — add `### Schema v2 migration note` block under existing `### Volume Mount` section
- **Modify**: `README.zh-TW.md` — grep `盲測` and replace with neutral terms
- **Modify**: `docs/USAGE.zh-TW.md` — grep `盲測` + rewrite line ~119 `participants` table description to the post-2B 5-field schema

## 1. RED — expand verify-intro-copy.ts to cover the broader surface

- [x] 1.1 In `web/scripts/verify-intro-copy.ts`, locate the existing `visibleText` construction (around line 64): `const visibleText = [intro.greeting, ...intro.paragraphs, ...intro.tasks].join("\n")`
- [x] 1.2 Replace that line with a wider join that also includes `studyConfig.study.title`, `studyConfig.study.rootTitle`, `studyConfig.study.eyebrow`, `studyConfig.study.completion.title`, `studyConfig.study.completion.description`, and `...studyConfig.study.completion.notes`; preserve the existing `intro.greeting + intro.paragraphs + intro.tasks` entries
- [x] 1.3 Add a new function `testComponentStringsAvoidJargon()` that uses `fs.readFileSync` to read the file contents of `web/components/evaluation/token-entry.tsx`, `web/components/evaluation/profile-form.tsx`, and `web/components/evaluation/question-flow.tsx`; for each file, assert that the content does NOT contain the substring `"盲測"` AND does NOT contain the substring `"Blind "` (with trailing space, to avoid matching `Blinded`/`Blinder`/etc); resolved relative to `process.cwd()` (which is `web/` because npm scripts run from package.json dir — verify-intro-copy.ts does NOT chdir, unlike other verify scripts) — also added `"Blind "` to `FORBIDDEN_KEYWORDS` so the visibleText scan catches `study.eyebrow` per spec scenario
- [x] 1.4 Wire `testComponentStringsAvoidJargon()` into the `main()` runner after the existing intro / signature assertions so it runs in the same invocation
- [x] 1.5 Verify RED: run `cd web && npm run verify:profile && npm run verify:intro-copy` and post the output. Expected failure: `verify:intro-copy` reports that the visible text or one of the component files contains `"盲測"`. This is the RED proof for tasks 2-5. **RED captured**: 6 failures — visibleText has `盲測` (title/rootTitle/completion) + `Blind ` (eyebrow); 3 component files have `盲測`; question-flow.tsx also has `Blind Comparison` on line 324 (folded into task 3.3).

## 2. GREEN — replace 5 config strings

- [x] 2.1 Open `web/config/evaluation.config.json`. Change `study.title` from `"金融專業回答盲測"` to `"金融腦回答比較研究"` (line ~4)
- [x] 2.2 Change `study.rootTitle` from `"金融專業回答盲測"` to `"金融腦回答比較研究"` (line ~5)
- [x] 2.3 Change `study.eyebrow` from `"Blind Model Evaluation"` to `"金融問答比較研究"` (line ~3)
- [x] 2.4 Change `study.completion.title` from `"感謝完成本次盲測問卷"` to `"感謝完成本次研究問卷"` (line ~30)
- [x] 2.5 Rewrite `study.completion.description` (line ~31) from `"你的回答已記錄。為了維持研究盲測設計，本頁不顯示模型身份、模型排名與比較結果。"` to `"你的回答已記錄。為了避免影響後續研究分析的客觀性，本頁不顯示模型身份、模型排名與比較結果。"`

## 3. GREEN — replace 3 component strings

- [x] 3.1 In `web/components/evaluation/token-entry.tsx` around line 88, change `<dd>A / B / C 匿名盲測</dd>` to `<dd>A / B / C 匿名回答比較</dd>`
- [x] 3.2 In `web/components/evaluation/profile-form.tsx` around line 198, change the submit button label `{isSubmitting ? "儲存中..." : "開始 5 題盲測問卷"}` to `{isSubmitting ? "儲存中..." : "開始 5 題問卷"}`
- [x] 3.3 In `web/components/evaluation/question-flow.tsx` around line 321, change `aria-label="盲測回答比較"` to `aria-label="匿名回答比較"` — **scope expansion**: also changed line 324 `<p className="panel-kicker">Blind Comparison</p>` to `<p className="panel-kicker">回答比較</p>` (spec scenario forbids `Blind` in participant components; visible kicker uses shorter text than the aria-label to avoid screen-reader double-announcement)

## 4. Verify GREEN — verify-intro-copy goes green

- [x] 4.1 Run `cd web && npm run verify:intro-copy` and post the output — all assertions PASS including the new `testComponentStringsAvoidJargon()` and the expanded `visibleText` jargon scan — **27 OK lines, PASS**
- [x] 4.2 Run `cd web && npm run verify:profile` (covers schema strictness) — must PASS as regression — **PASS, 13 tests OK**
- [x] 4.3 Run `cd web && npm run verify:provider-url && npm run verify:reset-pending && npm run verify:system-prompt && npm run verify:completion-gate` — all four regression scripts PASS — **all PASS**

## 5. Verify GREEN — full project gates

- [x] 5.1 Run `cd web && npm run lint` — clean (0 errors / 0 warnings) — **clean**
- [x] 5.2 Run `cd web && npm run typecheck` — clean — **clean**
- [x] 5.3 Run `cd web && npm run build` — completes; capture last 10 lines of output showing route table — **17 routes, no errors**

## 6. Docs sync — CLAUDE.md migration note

- [x] 6.1 In `CLAUDE.md`, locate the `### Volume Mount` section heading (search for `### Volume Mount`)
- [x] 6.2 At the end of that section (just before the next `### ` heading), append a new subsection: `**Schema v2 migration note**: After deploying any change that simplifies the participant profile schema (most recently `simplify-participant-profile-to-5-fields`), the admin must manually wipe `/src/.data/evaluation-store.json` on the Zeabur volume — legacy 13-field rows would cause the admin KPI bucket counting to misbehave (mainDomain undefined). Leave `platform-settings.json` untouched (it carries 2A's intro copy + system prompt). Mechanism: delete the file via the volume browser, or overwrite with `{"participants":[],"sessions":[],"pendingQuestions":[],"records":[]}`; lazy re-creation on first write picks up automatically.` — Volume Mount was the last section in the file (no following `### ` heading); appended to end of file with expanded `platform-settings.json` reasoning.

## 7. Docs sync — README.zh-TW.md

- [x] 7.1 Run `grep -n "盲測" README.zh-TW.md` to enumerate the occurrences — found 2 hits (line 1 H1, line 5 description); also caught `Blind ` in line 1 via the 7.4 sweep
- [x] 7.2 For each occurrence: replace `盲測` with the most contextually appropriate neutral term (`研究` for general phrasing, `比較` when the surrounding context is about comparing answers, `問卷` when referring to the questionnaire itself). Do not blanket-replace — read each line's surrounding context and pick the cleanest substitution — line 5 `盲測比較` → `匿名比較`
- [x] 7.3 Re-run `grep -n "盲測" README.zh-TW.md` to confirm zero matches remain — zero
- [x] 7.4 If any `Blind ` (English with trailing space) appears in README.zh-TW.md, drop it or translate to Chinese to match style — line 1 `# Finance Blind Evaluation` → `# 金融 LLM 回答比較評估` (translated to Chinese to match the `.zh-TW.md` convention)

## 8. Docs sync — docs/USAGE.zh-TW.md

- [x] 8.1 Run `grep -n "盲測" docs/USAGE.zh-TW.md` and replace each occurrence as in 7.2 — zero 盲測 hits (already clean)
- [x] 8.2 Read `docs/USAGE.zh-TW.md` around line 119 — the `participants` table description currently reads `每個 token 一列：背景、金融熟悉度、LLM 經驗、完成狀態、完成題數 / 上限`. Rewrite to: `每個 token 一列：年齡、學歷、目前主要領域、AI 使用頻率、是否曾用 AI 處理金融、完成狀態、完成題數 / 上限` (matching the post-2B 5-field profile shape) — applied
- [x] 8.3 Scan the surrounding `participants` / `records` documentation block for any other references to deleted fields (`性別`, `金融背景類型`, `金融工作經驗`, `投資經驗`, `金融子領域`, `gender`, `financeBackgroundType`, `llmExperience`, `financeFamiliarity`, `financeSubdomains`, `gradeOrOccupation`, `notes`, `knownName`); update or remove them so the docs reflect the current schema — pre-scan found only line 119 (already rewritten in 8.2); zero other legacy references in the file
- [x] 8.4 Re-run `grep -n "盲測\|金融熟悉度\|LLM 經驗\|gender\|financeBackgroundType\|llmExperience" docs/USAGE.zh-TW.md` — confirm zero matches remain — zero

## 9. Final regression sweep

- [x] 9.1 Run all 6 verify scripts in sequence and confirm each prints `PASS` or `OK`: `cd web && for s in profile provider-url reset-pending intro-copy system-prompt completion-gate; do echo "=== $s ==="; npm run verify:$s 2>&1 | tail -5; done` — all 6 PASS
- [x] 9.2 Confirm `cd web && npm run lint && npm run typecheck && npm run build` still clean after docs changes (docs aren't in TS check path but a sanity re-run catches accidental code edits) — all clean
- [x] 9.3 Confirm `openspec validate remove-blind-test-jargon-from-participant-copy --strict` exits clean — `Change 'remove-blind-test-jargon-from-participant-copy' is valid`

## 10. Post-deploy manual check (deferred, single step)

- [x] 10.1 (deferred to deploy) After Zeabur picks up the merged main, open `https://finance-blind-eval.zeabur.app/admin → 問卷文案` tab. Confirm the rendered title shows `金融腦回答比較研究`. If it still shows `金融專業回答盲測`, the admin previously edited the field via this tab and `platform-settings.json` carries the override — manually update the field in the admin UI to the new copy. Same check for `study.eyebrow`, `study.completion.title`, `study.completion.description`. No action needed for the 3 component strings (those ship with the code, not config). — **Deferred**: documented in CLAUDE.md schema v2 migration note + design.md migration plan; cannot be executed before Zeabur deploy. To be performed by user after PR merge → Zeabur picks up main.
