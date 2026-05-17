# Finance Blind Evaluation Web

Next.js implementation of the research survey-style blind evaluation workflow.

## Routes

- `/` — participant entry; requires the shared invite code (server-side gated by `eval_completed` cookie for re-entry)
- `/eval` — legacy redirect to `/` (preserves both `?invite=` and `?invite_code=`)
- `/admin` — research admin dashboard; use `/admin?token=<admin-link-token>` for magic-link entry
- `/api/session/redeem-invite` — validates the shared invite code, creates an anonymous participant ID, sets httpOnly session cookie
- `/api/session` — current participant session and profile submission
- `/api/evaluation/answers` — server-side model discovery, fanout, and A/B/C answer generation
- `/api/evaluation/records` — participant judgment recording; sets the `eval_completed` cookie on the final answer
- `/api/admin/auth/exchange` — exchanges an admin URL token for an httpOnly admin session cookie
- `/api/admin/auth/logout` — clears the admin session cookie
- `/api/admin/invite-qr` — admin-only read of the shared invite code plus a freshly rendered QR SVG
- `/api/admin/records` — admin snapshot data
- `/api/admin/export?format=json|csv` — exports
- `/api/admin/settings` — reads and saves runtime platform settings
- `/api/admin/settings/reset` — restores runtime settings to repository defaults
- `/api/admin/settings/export` — exports the active runtime settings JSON
- `/api/admin/provider/models` — discovers provider model IDs from active settings or a submitted provider draft
- `/api/admin/provider/test` — previews the configured A/B/C provider mapping without writing participant records

## Gateway Env

Use server-only variables in `.env.local`:

```bash
SHARED_INVITE_CODE=ailab502
OPENAI_COMPAT_API_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions
OPENAI_COMPAT_TEMPERATURE=0.2
OPENAI_COMPAT_MAX_TOKENS=1200
OPENAI_COMPAT_API_KEY_ENV=OPENAI_COMPAT_API_KEY
OPENAI_COMPAT_API_KEY=
ADMIN_LINK_TOKEN=replace-with-random-admin-entry-token
ADMIN_SESSION_SECRET=replace-with-random-session-secret
ADMIN_PASSWORD=replace-with-admin-password-before-public-deploy
```

Do not use `NEXT_PUBLIC_` for gateway API keys. The browser only calls Next.js API routes.

Optional variables:

```bash
OPENAI_COMPAT_MODELS_ENDPOINT=http://127.0.0.1:8080/v1/models
OPENAI_COMPAT_MODEL_H1=
OPENAI_COMPAT_MODEL_H2=
OPENAI_COMPAT_MODEL_TAIDE=
OPENAI_COMPAT_SYSTEM_PROMPT=
OPENAI_COMPAT_USER_PROMPT_TEMPLATE=
```

The admin page can save provider runtime settings for endpoint, models endpoint, A/B/C model mapping, system prompt, user prompt template, temperature, and max tokens. The raw API key is never stored in runtime settings; the admin UI only stores the env var name, and the server reads the secret from that variable.

## Local Persistence

Evaluation records and anonymous sessions are stored in `.data/evaluation-store.json` by default. You can change the file name with `EVALUATION_DATA_FILE`, but storage remains scoped under `.data/`. This is for local pilot use only and should be replaced with a durable database before production deployment.

Runtime platform settings are stored in `.data/platform-settings.json` by default. You can change the file name with `PLATFORM_SETTINGS_FILE`, but the file also remains scoped under `.data/`.

The runtime settings file includes study text plus non-secret provider settings. This makes the platform portable for open-source deployment while keeping provider secrets in server environment variables.

## Study Config

Public study text, signature metadata, prompt categories, example questions, evaluation facets, flags, and limits have a repository default template at:

```bash
config/evaluation.config.json
```

This file is safe to commit. At runtime, the app first checks `.data/platform-settings.json`; if no runtime file exists, it falls back to the repository default template. Admin settings APIs can save, reset, and export the runtime settings without modifying source files.

Do not put gateway API keys or provider secrets in either config file. API keys stay in environment variables such as `OPENAI_COMPAT_API_KEY`. The shared invite code likewise stays in `SHARED_INVITE_CODE`.

Current limitation: the participant-facing blind test still uses three internal candidates, `H1-best`, `H2-best`, and `TAIDE-baseline`, mapped to A/B/C per question. The admin UI can change which provider model each internal candidate points to. Fully dynamic candidate IDs are intentionally left for a later migration.

## Admin Access

Preferred shared-deployment entry:

```text
https://your-domain.example/admin?token=<ADMIN_LINK_TOKEN>
```

The token is validated server-side, exchanged for an httpOnly `admin_session` cookie, and then redirected to `/admin` so the token is removed from the address bar.

For hosted deployments, prefer storing only the token hash:

```bash
printf '%s' 'your-random-admin-token' | shasum -a 256
ADMIN_LINK_TOKEN_SHA256=<sha256-output>
ADMIN_SESSION_SECRET=<separate-random-session-secret>
```

`ADMIN_PASSWORD` remains supported as a Basic Auth fallback. In production, admin routes fail closed unless an admin link token or `ADMIN_PASSWORD` is configured.

## Shared Invite Code

The whole study uses a single fixed invite code supplied by `SHARED_INVITE_CODE` (recommended value `ailab502`). Distribute a single QR code that points at `https://your-domain.example/?invite_code=<code>`.

- The admin dashboard's `邀請碼` tab fetches `/api/admin/invite-qr` and renders the current code + a downloadable QR SVG. Re-deploys with a different env value pick up automatically.
- When `SHARED_INVITE_CODE` is unset, the redeem API returns HTTP 503 and the admin panel surfaces a warning — no participant can enter.
- The code is compared case-insensitively after stripping all Unicode whitespace, so paste-from-styled-doc still works.
- Re-entry is hard-blocked per browser via the `eval_completed` cookie (HttpOnly, 365d). Clearing cookies allows re-entry — by design.

## Public Deployment Notes

- Set `SHARED_INVITE_CODE` in your deployment platform (Zeabur, Vercel, etc.) before the first participant arrives.
- Set `ADMIN_LINK_TOKEN` or `ADMIN_LINK_TOKEN_SHA256` for admin magic-link entry. Keep `ADMIN_PASSWORD` as a fallback if desired.
- Set `ADMIN_SESSION_SECRET` to a separate high-entropy value in deployments.
- The `eval_completed` and `eval_session` cookies set the `Secure` flag only when `NODE_ENV=production`. `next start` sets this automatically; if you ever override it, expect cleartext cookies.
- Keep gateway credentials server-side only.
- Keep `.data/platform-settings.json` uncommitted; use it for deployment/runtime customization.
- The built-in rate limiter is in-memory and suitable for a single Node process or pilot deployment. For multi-instance production, move rate limits and persistence to Redis/KV or a database.
- Upgrade Next.js before serious public deployment if `npm audit` reports framework vulnerabilities for the installed version.

## Commands

```bash
npm run dev -- --port 5174
npm run typecheck
npm run lint
npm run build
node scripts/verify-invite-flow.mjs  # smoke-tests the redeem flow against a running dev server
```
