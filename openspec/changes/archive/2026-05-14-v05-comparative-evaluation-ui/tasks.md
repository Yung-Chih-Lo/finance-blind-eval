## 1. Data Contract

- [x] 1.1 Add evaluation facet definitions and worst-answer flag definitions in `web/lib/evaluation/config.ts`.
- [x] 1.2 Update `web/lib/evaluation/types.ts` with facet selection fields, worst-answer flags, and backward-compatible optional old rating fields.
- [x] 1.3 Run `cd web && npm run typecheck` and confirm the new contract compiles before UI wiring.

## 2. Participant Judgment Flow

- [x] 2.1 Replace the rating-based `QualityControls` UI with facet-level A/B/C comparative controls.
- [x] 2.2 Update `web/components/evaluation/question-flow.tsx` state, reset behavior, validation copy, and submit payload for comparative fields.
- [x] 2.3 Update responsive CSS in `web/app/globals.css` so the revised evaluation panel remains usable on desktop and mobile.
- [x] 2.4 Run `cd web && npm run typecheck` and fix participant-flow typing errors.

## 3. Server Persistence

- [x] 3.1 Update `web/app/api/evaluation/records/route.ts` to validate overall best/worst, all facet selections, reasons, and worst-answer flags.
- [x] 3.2 Update `web/lib/server/evaluation-storage.ts` CSV/JSON export fields to include comparative selections and resolved model IDs.
- [x] 3.3 Run `cd web && npm run typecheck` and fix server contract errors.

## 4. Admin Research Console

- [x] 4.1 Add admin aggregation helpers for overall best, overall worst, facet counts, net score, and worst-flag counts by resolved model.
- [x] 4.2 Update `web/app/admin/page.tsx` to show model-level comparative statistics and per-record facet selections.
- [x] 4.3 Run `cd web && npm run typecheck` and fix admin typing errors.

## 5. Final Verification

- [x] 5.1 Run `openspec validate v05-comparative-evaluation-ui --strict`.
- [x] 5.2 Run `cd web && npm run lint`.
- [x] 5.3 Run `cd web && npm run typecheck`.
- [x] 5.4 Run `cd web && npm run build`.
