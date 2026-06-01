# Project notes

## Zeabur Deployment

- **Project**: `public-service`
- **Project ID**: `69b00f05d00471cc19a0b524`
- **Environment ID**: `69b00f05663e36e8afe63141`
- **Service ID**: `6a06c9fdeb6e67d8262aba62`
- **Service name**: `finance-blind-eval`
- **Region**: `Yung_others` (server-697c471c0f19f38d75bddcba, Tencent)
- **Deploy source**: `web/` subdir (respects `web/.gitignore`)
- **Public URL**: https://finance-blind-eval.zeabur.app
- **Internal DNS**: `finance-blind-eval.zeabur.internal:8080` (HTTP)
- **Deploy trigger**: **auto** — Zeabur watches the GitHub repo's `main` branch
  via its GitHub integration (configured on the Zeabur dashboard, **not** in
  this repo — there is no `.github/workflows/` or `zeabur.json`). Normal release
  flow: PR merge → push to `main` → Zeabur picks up the new commit and
  rebuilds via zbpack (Next.js auto-detected). No CLI invocation needed.

Manual redeploy fallback — only when the GitHub integration didn't trigger
(rare) or you need to force-rebuild without pushing a new commit. Must pass
`--service-id` to update in place, not create a duplicate:

```bash
cd web
npx zeabur@latest deploy \
  --project-id 69b00f05d00471cc19a0b524 \
  --service-id 6a06c9fdeb6e67d8262aba62 \
  --json
```

### Env Vars

Configured (values held in Zeabur, not committed):
- `ADMIN_LINK_TOKEN`, `ADMIN_LINK_TOKEN_SHA256`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD`
- `OPENAI_COMPAT_API_KEY_ENV=OPENAI_COMPAT_API_KEY`
- `PORT=${WEB_PORT}` (auto, listens on 8080)
- `SHARED_INVITE_CODE=ailab502` — single shared invite code for all participants. Without it, the redeem API returns 503 and the admin QR panel shows a "not configured" warning.
- `PUBLIC_BASE_URL=https://finance-blind-eval.zeabur.app` — origin used to build the invite QR link in `/api/admin/invite-qr`. Set this in Zeabur so the QR points at the participant-facing host even when admin opens the panel via internal DNS or another proxy. Falls back to `request.url` origin when unset.

Pending (set when LLM gateway is ready):
- `OPENAI_COMPAT_API_BASE_URL` — gateway base URL (e.g. `https://owui-llm.vixight.com/v1`). Do **not** include `/chat/completions`; the server appends `/chat/completions` and `/models` itself.
- `OPENAI_COMPAT_API_KEY`
- (optional) `OPENAI_COMPAT_MODELS_ENDPOINT` — overrides the derived `${base}/models` URL when discovery lives on a different host
- (optional) `OPENAI_COMPAT_MODEL_H1` / `H2` / `TAIDE`

**Migration note**: After deploying the `provider-api-base-url` change, open `/admin`. If a banner reports `偵測到舊版 provider 設定格式`, press the in-page reset button (or call `POST /api/admin/settings/reset`) to drop the legacy `chatCompletionsEndpoint` / `modelsEndpoint` keys from the persisted `platform-settings.json`.

Cookie note: both `eval_session` and `eval_completed` set the `Secure` flag
only when `NODE_ENV=production`. Zeabur's zbpack runs `next start` which sets
this automatically, so this is fine in the default deploy. If anyone ever
overrides `NODE_ENV` to debug in production, expect cleartext cookies on any
non-HTTPS hop.

### Volume Mount

Mount a persistent volume at `/src/.data`. Verified container cwd is `/src`
(Zeabur zbpack's Next.js work dir), and `evaluation-storage.ts` writes to
`join(process.cwd(), ".data", ...)`, so the actual runtime path is
`/src/.data/{evaluation-store.json, platform-settings.json}`.

Note: `.data/` is lazy-created on first write. An empty `.data/` directory has
been pre-created inside the container so the volume can attach immediately.

Configure via Zeabur dashboard — Service → Settings (or Volumes section) → Add
Volume with **Mount Path `/src/.data`**.

**Schema v2 migration note** — *v2 = post-2B 5-field profile (`年齡` / `學歷` /
`目前主要領域` / `AI 使用頻率` / `是否曾用 AI 處理金融`); v1 = legacy 13-field
shape with `financeBackgroundType` / `llmExperience` / `financeFamiliarity` /
`financeSubdomains` / `gradeOrOccupation` / `gender` / etc.*

After deploying any change that simplifies the participant profile schema
(most recently `simplify-participant-profile-to-5-fields`), the admin must
manually wipe `/src/.data/evaluation-store.json` on the Zeabur volume — legacy
v1 rows would cause the admin KPI bucket counting to misbehave (`mainDomain`
undefined for old rows). Leave `platform-settings.json` untouched (it carries
2A's intro copy + system prompt — clearing it would also wipe any admin-side
runtime overrides of the study title / intro paragraphs). Mechanism: delete
the file via the volume browser, or overwrite with
`{"participants":[],"sessions":[],"pendingQuestions":[],"records":[]}`; lazy
re-creation on first write picks up automatically.
