# Project notes

## Zeabur Deployment

- **Project**: `public-service`
- **Project ID**: `69b00f05d00471cc19a0b524`
- **Environment ID**: `69b00f05663e36e8afe63141`
- **Service ID**: `6a06c9fdeb6e67d8262aba62`
- **Service name**: `finance-blind-eval`
- **Region**: `Yung_others` (server-697c471c0f19f38d75bddcba, Tencent)
- **Deploy source**: direct deploy from `web/` (respects `web/.gitignore`)
- **Public URL**: https://finance-blind-eval.zeabur.app
- **Internal DNS**: `finance-blind-eval.zeabur.internal:8080` (HTTP)

To redeploy after code changes (must pass `--service-id` to update in place, not create a duplicate):

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

Pending (set when LLM gateway is ready):
- `OPENAI_COMPAT_API_ENDPOINT`
- `OPENAI_COMPAT_API_KEY`
- (optional) `OPENAI_COMPAT_MODEL_H1` / `H2` / `TAIDE`

### Volume Mount

Mount a persistent volume at `/src/.data`. Verified container cwd is `/src`
(Zeabur zbpack's Next.js work dir), and `evaluation-storage.ts` writes to
`join(process.cwd(), ".data", ...)`, so the actual runtime path is
`/src/.data/{evaluation-store.json, platform-settings.json}`.

Note: `.data/` is lazy-created on first write. An empty `.data/` directory has
been pre-created inside the container so the volume can attach immediately.

Configure via Zeabur dashboard — Service → Settings (or Volumes section) → Add
Volume with **Mount Path `/src/.data`**.
