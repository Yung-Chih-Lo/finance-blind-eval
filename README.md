# Finance Blind Evaluation

> 繁體中文版：[README.zh-TW.md](./README.zh-TW.md)

A research survey app for **blind comparison of three finance-domain LLM answers**. Participants see three anonymized answers labeled A / B / C — the real model identity is never revealed in the browser — and pick the best, the worst, and the strongest model on each evaluation facet. Built for a Master's thesis on finance-domain LLM continual pre-training & PEFT.

Stack: **Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn (radix-nova)**. File-backed JSON store (no DB). OpenAI-compatible gateway for the LLMs.

## Quick start

```bash
cd web
cp .env.example .env.local        # then fill OPENAI_COMPAT_* + ADMIN_*
npm install
npm run dev -- --port 5174
```

Open `http://localhost:5174/eval` for the participant entry, or `http://localhost:5174/admin?token=<ADMIN_LINK_TOKEN>` for the research console.

Generate invite codes + QR SVGs:

```bash
cd web
npm run invites:create -- --count 40 --base-url http://localhost:5174
```

## Architecture

```
┌─────────────┐   HTTPS    ┌──────────────────┐   HTTPS    ┌─────────────────────┐
│  Browser    │ ─────────▶ │  Next.js server  │ ─────────▶ │  LLM gateway        │
│  /eval      │            │  (App Router)    │            │  (OpenAI-compatible │
│  /admin     │ ◀───────── │  /api/* routes   │ ◀───────── │   chat/completions) │
└─────────────┘            └──────────────────┘            └─────────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  web/.data/      │
                           │   evaluation-    │
                           │     store.json   │
                           │   platform-      │
                           │     settings.json│
                           └──────────────────┘
```

The browser **never** sees the gateway API key or the hidden A/B/C → real-model mapping. All gateway calls are server-side. Participant data, invite codes, and admin settings live in JSON files under `web/.data/` (gitignored).

## Documentation

- [docs/USAGE.en.md](./docs/USAGE.en.md) — Detailed setup, participant + admin walkthroughs, API reference (English)
- [docs/USAGE.zh-TW.md](./docs/USAGE.zh-TW.md) — 同上，繁體中文版本

## Project layout

```
eval-ui/
├── web/                 # Active Next.js app (use this)
├── vite/                # Legacy Vite prototype (kept for migration reference)
├── openspec/            # Spec-driven workflow: specs + change history
├── docs/                # Usage / API docs (EN + ZH-TW)
└── plan.md              # Multi-phase platformization plan
```

## Verification

```bash
cd web
npm run typecheck
npm run lint
npm run build
```

## License

[MIT](./LICENSE) © 2026 Yung
