## Why

The 2026-05-20 advisor meeting (`金融語言模型問卷設計討論會議`) gave three concrete directives that the live deployment still violates and that block the advisor from doing the agreed `下週試玩` validation pass before the 5/30 Shenzhen workshop submission:

1. **Participant-facing intro leaks researcher-only terminology** — the live `study.intro.paragraphs` still says `大型語言模型`, `主要分層變項預先指定為金融工作或實習經驗，金融熟悉度作為次要連續變項`, and `signature.thesisTitle` is set to `The Augmentative Residual Adapter Approach to Pre-training` which directly exposes APT. Advisor was explicit: `受測者不需要了解 H1-base、H2-base、盲測、APT 等技術名詞`.
2. **Default system prompt is one neutral sentence** with no `金融腦` scope enforcement — advisor: `你就是要 RIG 啊...金融語言模型...如果你問我戀愛問題我當然就可以跟你說對不起這個不在我的規格範圍`. Without RAG (deferred to future work) the system prompt is the only available place to enforce finance-only refusal and disclaim real-time / tool-requiring questions.
3. **Spec allows participant to stop before answering all five questions** — current `Guided flexible prompt flow` requirement only says `present exactly five guided prompt categories`, with no scenario that blocks completion when fewer than 5 are answered. Advisor decided `寫至多五題` was ambiguous and ended on `製作五題就確定是這樣` after the questionnaire-validity discussion. Without an explicit completion gate, analysis-time `valid vs invalid` filtering becomes a per-record exercise.

This change addresses items 1-3 only. Profile schema rewrite (13 → 5 fields), `.data` reset, and legacy mechanism removal are deferred to a separate change so this one can ship within 1-2 hours and unblock the advisor demo while the larger schema work proceeds in parallel.

## What Changes

- Replace the participant-facing `study.intro` default copy in `web/config/evaluation.config.json` with the four-paragraph + three-task neutral version that removes `大型語言模型 / 主要分層變項 / 預先指定` researcher-frame wording. Replace `signature.thesisTitle` with a neutral Chinese title (`金融語言模型回答品質之研究`).
- Replace the `DEFAULT_SYSTEM_PROMPT` in `web/lib/server/provider-settings.ts` with a `金融腦` system prompt that (a) declares finance-only scope, (b) refuses non-finance questions with a service-scope explanation, (c) refuses real-time / external-tool-dependent queries, (d) declines specific buy/sell advice while allowing concept and framework explanations, (e) forbids mention of model name / blind testing / A/B/C labels, (f) requires `繁體中文` output. The same default applies to all three internal model IDs (`H1-best`, `H2-best`, `TAIDE-baseline`) so prompt-setting differences do not contaminate the blind comparison.
- Add new spec scenarios that pin (a) participant intro avoiding researcher-only terminology, (b) provider default system prompt enforcing finance-brain scope refusal, (c) provider default system prompt refusing real-time / external-tool queries, (d) participants cannot mark the questionnaire complete with fewer than 5 answered questions.

This change does NOT touch: `ParticipantProfile` schema, `promptCategories` structure or examples, `DEFAULT_USER_PROMPT_TEMPLATE` (the `{{categoryTitle}} / {{categoryInstruction}}` variables stay), `evaluation-store.json` data, the legacy `migrateLegacyProfile / legacy_* CSV columns / legacyProfile JSON block / form re-prompt scenarios` from change `2026-05-18-refine-participant-profile-fields`, or RAG integration (advisor: `這也是未來`).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `blind-evaluation-app`: Add scenarios under `Participant study validity instructions` (intro must avoid researcher-only terms), `Server-mediated model answer generation` or a new `Provider default system prompt` requirement (finance-brain scope refusal, real-time refusal), and `Required blind comparison judgments` (completion gate requires 5 answered questions).

## Impact

- **Source files**:
  - `web/config/evaluation.config.json` — `study.intro.greeting / paragraphs / tasks` and `study.signature.thesisTitle` default values
  - `web/lib/server/provider-settings.ts` — `DEFAULT_SYSTEM_PROMPT` constant
  - `web/lib/server/evaluation-storage.ts` — completion gate enforcement when computing `completionStatus = "completed"` (must require `recordsForParticipant.length === 5`, not `>= 1`)
- **Spec**: `openspec/specs/blind-evaluation-app/spec.md` — appended scenarios under existing requirements; no requirement removals; no `BREAKING` flag (default copy changes only, no data shape changes).
- **Persisted data**: existing `.data/evaluation-store.json` records are unaffected — none of the changed fields are stored on records. Existing runtime `platform-settings.json` may carry the old `systemPrompt` value (since admin can edit it via the study-copy editor); the new default only applies when admin resets settings or when no runtime settings file exists. A migration note in the proposal recommends admin runs `POST /api/admin/settings/reset` after deployment if they want the new finance-brain default.
- **No new dependencies**.
- **Backward compatibility**: existing pending questions or saved records keep their stored `systemPrompt` value (per `Settings version reproducibility` requirement). No data migration required.
- **Deployment**: Zeabur redeploy via `cd web && npx zeabur@latest deploy --project-id 69b00f05d00471cc19a0b524 --service-id 6a06c9fdeb6e67d8262aba62 --json`.
