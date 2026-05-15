# Usage & API Reference (English)

> 繁體中文：[USAGE.zh-TW.md](./USAGE.zh-TW.md)

This guide covers setup, the participant flow, the admin research console, and the API surface — both **how the Next.js server connects to the LLM gateway**, and **what HTTP endpoints the app exposes**.

---

## 1. Prerequisites

- Node.js ≥ 20 (Next.js 16 requirement)
- An **OpenAI-compatible chat-completions endpoint** that exposes at least three models. Tested with vLLM / TGI / llama.cpp / OpenAI proxy gateways. Anything that responds to `POST /v1/chat/completions` and `GET /v1/models` works.
- A machine that can reach that endpoint from the Next.js server (LAN, public, or `localhost`).

---

## 2. Environment configuration

All env vars are **server-only**. They live in `web/.env.local`. There must be **no `NEXT_PUBLIC_*` keys for secrets** — those leak to the browser bundle.

```bash
# LLM gateway
OPENAI_COMPAT_API_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions
OPENAI_COMPAT_API_KEY=sk-...                # optional if your gateway is open
OPENAI_COMPAT_API_KEY_ENV=OPENAI_COMPAT_API_KEY
OPENAI_COMPAT_MODELS_ENDPOINT=              # optional override; defaults to <chat endpoint>/../models
OPENAI_COMPAT_TEMPERATURE=0.2
OPENAI_COMPAT_MAX_TOKENS=1200

# Optional: pin which 3 models to use. If omitted, admin can pick from /v1/models in the UI.
OPENAI_COMPAT_MODEL_H1=
OPENAI_COMPAT_MODEL_H2=
OPENAI_COMPAT_MODEL_TAIDE=

# Optional: prompt defaults (admin UI overrides these at runtime)
OPENAI_COMPAT_SYSTEM_PROMPT=
OPENAI_COMPAT_USER_PROMPT_TEMPLATE=

# Admin auth
ADMIN_LINK_TOKEN=<random 32+ char token>          # plain token for the magic-link URL
ADMIN_LINK_TOKEN_SHA256=<sha256 of above>         # used for constant-time comparison
ADMIN_SESSION_SECRET=<random 32+ char secret>     # signs the admin session cookie
ADMIN_PASSWORD=<basic-auth password>              # fallback when token flow is unavailable

# Runtime settings file (optional override)
PLATFORM_SETTINGS_FILE=                            # defaults to web/.data/platform-settings.json
EVALUATION_DATA_FILE=                              # defaults to web/.data/evaluation-store.json
```

Generate the admin token + its SHA-256 once with:

```bash
node -e "
const c = require('crypto');
const t = c.randomBytes(32).toString('hex');
console.log('ADMIN_LINK_TOKEN=' + t);
console.log('ADMIN_LINK_TOKEN_SHA256=' + c.createHash('sha256').update(t).digest('hex'));
console.log('ADMIN_SESSION_SECRET=' + c.randomBytes(32).toString('hex'));
"
```

---

## 3. Running locally

```bash
cd web
npm install
npm run dev -- --port 5174
```

Verification commands:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build
```

---

## 4. Participant flow (`/eval`)

```
Invite code  →  Profile form  →  Question 1 ... Question N  →  Completion
```

1. **Invite**: Researcher hands the participant a code (or QR code that encodes `/eval?invite=<code>`).
2. **Redeem**: `/eval` exchanges the invite for an anonymous participant token + httpOnly session cookie. The code can only be redeemed once (configurable `maxUses`).
3. **Profile**: Participant fills basic background (finance / non-finance, familiarity 1–5, LLM experience, etc.). Stored in the participant record.
4. **Per question**: Participant types a finance question. The server:
   - Picks 3 models (deterministic from runtime settings, or randomized per request — depends on config)
   - Calls the gateway 3× in parallel
   - Shuffles the answers into labels A / B / C, keeps the mapping `A → modelX`, `B → modelY`, `C → modelZ` **server-side only**
   - Returns `{A, B, C}` answer text to the browser
5. **Judgment**: Participant selects (a) the overall best answer, (b) the overall worst, (c) the best answer for each evaluation facet (correctness / reasoning / completeness / readability), and (d) optional reason text + worst-answer flags.
6. **Repeat** until the configured max question count is reached, then `/completion`.

The browser never sees the model IDs. The mapping only appears in `evaluation-store.json` and the admin export.

---

## 5. Admin research console (`/admin`)

The admin URL is a **magic link**:

```
https://your.domain/admin?token=<ADMIN_LINK_TOKEN>
```

The server validates the token (constant-time compare against `ADMIN_LINK_TOKEN_SHA256`), sets an `admin_session` cookie (signed with `ADMIN_SESSION_SECRET`), then redirects to `/admin` without the token in the URL. If the magic link is unavailable, `ADMIN_PASSWORD` works as a Basic Auth fallback.

The console is a **sidebar dashboard** with seven tabs (deep-linkable via `?tab=<id>`):

| Tab id | Purpose |
|---|---|
| `overview` | Participant funnel (Invited → Redeemed → Profile → Answered → Completed), worst-answer-flag top 3, latency outliers (> p95), stalled participants, model leaderboard sorted by net (best − worst) |
| `participants` | Per-token table: background, finance familiarity, LLM experience, completion status, answered count / max |
| `models` | Leaderboard + comparative best/worst/net by facet + worst-flag counts |
| `invites` | Invite usage summary + generation actions |
| `provider` | Editable gateway endpoint, models endpoint, model picker (calls `/v1/models`), system prompt, user-prompt template, temperature, max tokens; includes a "test call" preview that does NOT write to records |
| `study-copy` | Editable participant-facing copy: intro letter, prompt categories, examples, signature metadata, completion page text |
| `records` | Per-question records table (token · # · category · best · worst · latency); click any row → side drawer with full question text, facet selections, worst-answer flags, hidden mapping, reason text |

The sidebar can be collapsed (top-left toggle). Content scrolls independently of the sidebar; the header bar stays sticky.

---

## 6. How Next.js connects to the LLM gateway

### Where the call happens

`web/lib/server/answer-generation.ts` (and its callers in `app/api/evaluation/answers/route.ts`). The function:

1. Reads the **active platform settings** (file-backed; admin overrides at runtime)
2. Resolves the three target model IDs (from `OPENAI_COMPAT_MODEL_*` env vars OR admin-picked names)
3. For each model, builds the request body:
   ```json
   {
     "model": "<modelId>",
     "messages": [
       { "role": "system", "content": "<system prompt from settings>" },
       { "role": "user",   "content": "<user prompt template filled with the question>" }
     ],
     "temperature": 0.2,
     "max_tokens": 1200
   }
   ```
4. Issues a `POST` to `OPENAI_COMPAT_API_ENDPOINT` with header `Authorization: Bearer ${process.env[OPENAI_COMPAT_API_KEY_ENV]}` (the admin UI only stores the **name** of the env var, never the raw key)
5. Awaits the three responses, measures latency, randomizes the A/B/C label order
6. Returns to the browser **only** `{ A: "...", B: "...", C: "..." }` plus a pending-question ID. The mapping table stays on the server.

### Models discovery

The admin "Provider 設定" tab calls **`GET /api/admin/provider/models`** which proxies a server-side request to `OPENAI_COMPAT_MODELS_ENDPOINT` (defaults to `<chat endpoint base>/v1/models`). The response is the gateway's raw `data: [{ id: "..." }]` array, surfaced as a select control so the admin can pin which three model IDs map to the H1 / H2 / TAIDE slots.

### Provider test (dry run)

`POST /api/admin/provider/test` with a sample question runs one round of generation **without writing** any participant record. Useful for validating prompt edits before opening invites.

### Settings hot-reload

`PUT /api/admin/settings` writes `web/.data/platform-settings.json` and bumps `settingsVersion`. The next answer-generation call picks up the new value immediately. Old records carry their `settingsVersion` + `settingsSnapshotHash` so analyses remain reproducible.

---

## 7. API reference (HTTP endpoints)

All endpoints are Next.js Route Handlers under `web/app/api/`. **All admin routes require the `admin_session` cookie** (or Basic Auth fallback). Participant routes require an active participant session cookie minted by `/api/session/redeem-invite`.

### Participant routes

| Method · Path | Purpose |
|---|---|
| `POST /api/session/redeem-invite` | Exchange invite code for participant token + session cookie. Body: `{ invite }`. |
| `GET  /api/session` | Read the current participant session (token + status). |
| `POST /api/session/token` | Refresh / rotate the participant session. |
| `POST /api/evaluation/answers` | Generate three answers for a new question. Body: `{ userQuestion, promptCategory }`. Returns `{ pendingQuestionId, answers: {A,B,C} }`. |
| `POST /api/evaluation/records` | Submit the participant's judgment for a pending question. Body: `{ pendingQuestionId, selectedBest, selectedWorst, facetSelections, worstAnswerFlags?, bestReason?, worstReason? }`. |

### Admin routes

| Method · Path | Purpose |
|---|---|
| `GET  /api/admin/auth/exchange` | Magic-link → cookie exchange (called by `/admin?token=...`). |
| `POST /api/admin/auth/logout` | Clear `admin_session` cookie. |
| `GET  /api/admin/records` | Return the full `AdminSnapshot` (participants, records, model counts, funnel, attention items). |
| `GET  /api/admin/export?format=json` | Download evaluation data as JSON. |
| `GET  /api/admin/export?format=csv` | Download evaluation data as CSV (one row per answered question). |
| `POST /api/admin/invites` | Generate N invite codes + QR SVGs. Body: `{ count, baseUrl, label? }`. |
| `GET  /api/admin/settings` | Read active platform settings. |
| `PUT  /api/admin/settings` | Write/replace platform settings. Body: full `StudyConfig` envelope. |
| `POST /api/admin/settings/reset` | Reset to repo default (`web/config/evaluation.config.json`). |
| `GET  /api/admin/settings/export` | Download current platform settings as JSON. |
| `GET  /api/admin/provider/models` | Proxied `GET /v1/models` for model picker. |
| `POST /api/admin/provider/test` | Dry-run generate with a sample question; does NOT write records. |

---

## 8. Storage layout

```
web/.data/
├── evaluation-store.json          # all participants, records, invites, sessions
├── platform-settings.json         # runtime study config (versioned)
└── invite-qr/
    ├── invites.csv                # generated codes + redeem URLs
    └── <code>.svg                 # one QR per code
```

`web/.data/` is **gitignored** because it contains participant PII and live invite codes. Treat it as the production database — back it up regularly (`cp -r web/.data/ backups/$(date +%Y%m%d)/`).

Override the file paths with `PLATFORM_SETTINGS_FILE` and `EVALUATION_DATA_FILE` env vars if you need to point at a mounted volume in production.

---

## 9. Deployment notes

- The Next.js app is stateless **at the framework level** but stateful through the JSON store on disk. For multi-instance deployment you must put the JSON store on a shared volume or replace it (the `evaluation-storage.ts` module is a single boundary to swap for a real DB).
- The gateway endpoint can be anywhere reachable from the server. Common pattern: deploy the eval app on a researcher-controlled host, run the LLM gateway on a GPU node, restrict the gateway to the eval host's IP.
- For HTTPS: deploy behind a reverse proxy (nginx, Caddy, Cloudflare). Cookies are `Secure` + `SameSite=Lax` in production.

---

## 10. Verification checklist before opening invites

1. `npm run build` succeeds on the deploy host.
2. `GET /api/admin/provider/models` returns the expected model list.
3. `POST /api/admin/provider/test` with a sample question returns three answers within `OPENAI_COMPAT_MAX_TOKENS` budget.
4. Generate one invite, redeem it in an incognito browser, complete one question end-to-end, then verify the record appears in `/admin?tab=records`.
5. Export JSON + CSV; verify `hidden_mapping_*` columns contain real model IDs.

Once 1–5 pass, you can safely hand out invites.
