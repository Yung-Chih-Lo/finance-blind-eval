## Why

The 2026-05-20 advisor meeting set a policy that participants should not be exposed to researcher-only terminology like `盲測`, `H1`, `H2`, `APT`, `Blind`. Change 2A (`align-advisor-feedback-copy-and-prompt`, PR #7) cleaned the intro paragraphs, tasks, and thesisTitle — but only those three slots. A grep on the post-2B `main` reveals 8 user-visible (sighted) places where `盲測` or `Blind` still appears: 4 in `web/config/evaluation.config.json` (`study.title`, `study.rootTitle`, `study.eyebrow`, `study.completion.title`, `study.completion.description`), 2 in component code (`token-entry.tsx` participant entry caption, `profile-form.tsx` submit button), and 1 a11y label in `question-flow.tsx`. The advisor will run real participants on this build within the week — these strings are visible on the first page, the submit-to-questions transition, and the final completion screen, so they would surface the jargon at the moments where the advisor explicitly asked us not to. The existing `Participant intro neutral terminology` spec requirement only pins the intro paragraphs — its `verify-intro-copy.ts` guard reads `intro.greeting + paragraphs + tasks`, which is exactly why these 8 slots survived. Tightening the requirement to cover title / completion / participant-facing component strings closes the gap before the deploy.

## What Changes

- Replace `web/config/evaluation.config.json` `study.title` and `study.rootTitle` `"金融專業回答盲測"` with `"金融腦回答比較研究"` (aligned with 2A's `金融腦` framing already used in `DEFAULT_SYSTEM_PROMPT`).
- Replace `study.eyebrow` `"Blind Model Evaluation"` with `"金融問答比較研究"` (drop English Blind-prefixed caption).
- Replace `study.completion.title` `"感謝完成本次盲測問卷"` with `"感謝完成本次研究問卷"`.
- Replace `study.completion.description` jargon clause `"...為了維持研究盲測設計，本頁不顯示模型身份..."` with `"...為了避免影響後續研究分析的客觀性，本頁不顯示模型身份、模型排名與比較結果。"`.
- Replace `web/components/evaluation/token-entry.tsx:88` `"A / B / C 匿名盲測"` with `"A / B / C 匿名回答比較"`.
- Replace `web/components/evaluation/profile-form.tsx` submit-button label `"開始 5 題盲測問卷"` with `"開始 5 題問卷"`.
- Replace `web/components/evaluation/question-flow.tsx` `aria-label="盲測回答比較"` with `aria-label="匿名回答比較"`.
- Expand `web/scripts/verify-intro-copy.ts` `visibleText` to include `study.title`, `study.rootTitle`, `study.eyebrow`, `study.completion.title`, `study.completion.description`, and `study.completion.notes`.
- Add a new verify assertion `testComponentStringsAvoidJargon()` that reads the three participant-facing components via `fs.readFileSync` and asserts neither `"盲測"` nor `"Blind "` (trailing space to avoid `Blinded`/`Blinder`) appears in their source.
- Add a `Schema v2 migration note` block to `CLAUDE.md` under `### Volume Mount` documenting the post-deploy `.data/evaluation-store.json` wipe step (2A + 2B carried this as a deferred deployment task but it is not yet in deploy docs).
- Sync `README.zh-TW.md` and `docs/USAGE.zh-TW.md`: replace any remaining `盲測` references with neutral terms, and update `docs/USAGE.zh-TW.md:119`'s `participants` table description (still mentions deleted fields `金融熟悉度` / `LLM 經驗`) to the post-2B 5-field schema (年齡 / 學歷 / 目前主要領域 / AI 使用頻率 / 是否曾用 AI 處理金融).

## Capabilities

### New Capabilities

(None — extends an existing capability.)

### Modified Capabilities

- `blind-evaluation-app`: One requirement, `Participant intro neutral terminology`, receives MODIFIED scope expansion. The existing description and 3 scenarios (`Intro copy avoids researcher-only terms` / `Signature title avoids exposing training method` / `Default config seeds neutral intro`) remain. Three new scenarios are added to pin the broader surface:
  - **Study title and root title avoid technical jargon** — `study.title` / `study.rootTitle` / `study.eyebrow` MUST NOT contain `盲測` or `Blind`.
  - **Completion screen avoids technical jargon** — `study.completion.title` / `study.completion.description` / `study.completion.notes` MUST NOT contain `盲測`.
  - **Participant-facing component strings avoid technical jargon** — `web/components/evaluation/{token-entry,profile-form,question-flow}.tsx` source MUST NOT contain `盲測` or `Blind `.

## Impact

- **Affected source**: `web/config/evaluation.config.json` (5 string fields), `web/components/evaluation/token-entry.tsx`, `web/components/evaluation/profile-form.tsx`, `web/components/evaluation/question-flow.tsx`, `web/scripts/verify-intro-copy.ts`.
- **Affected docs**: `CLAUDE.md`, `README.zh-TW.md`, `docs/USAGE.zh-TW.md`.
- **Spec contract**: 1 requirement in `blind-evaluation-app` gets MODIFIED (3 new scenarios appended). Zero new requirements. Zero requirement removals.
- **No interaction with 2A or 2B**: 2A's intro / system prompt / completion gate logic and 2B's 5-field profile schema are orthogonal to participant-facing copy strings.
- **No external API / data shape impact**: pure copy + verify expansion + docs sync.
- **Admin path unaffected**: `web/app/admin/page.tsx:323` `"盲測資料後台"` is researcher-facing and intentionally kept (admin is allowed to see technical jargon — the policy applies only to participants).
- **Deployment**: ships in the same Zeabur deploy cycle as a copy-only follow-up. Admin should reach `/admin` → `問卷文案` tab after deploy and check that the rendered title / completion match the new defaults; if the platform-settings.json was previously edited via admin to override these strings, that override wins and the admin must update them manually.
