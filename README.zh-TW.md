# 金融 LLM 回答比較評估

> English: [README.md](./README.md)

針對 **三個金融領域 LLM 答案的匿名比較** 研究問卷 app。受測者看到 A / B / C 三份匿名答案 — 真實模型身分不會出現在瀏覽器 — 然後選整體最佳 / 最差，以及每個評估面向上最強的那一份。為碩士論文（金融領域 LLM 持續預訓練 + PEFT）打造。

技術棧：**Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn (radix-nova)**。檔案型 JSON 儲存（無資料庫）。LLM 走 OpenAI 相容 gateway。

## 快速開始

```bash
cd web
cp .env.example .env.local        # 然後填 OPENAI_COMPAT_* + ADMIN_*
npm install
npm run dev -- --port 5174
```

受測者入口：`http://localhost:5174/eval`
研究後台：`http://localhost:5174/admin?token=<ADMIN_LINK_TOKEN>`

產生邀請碼 + QR SVG：

```bash
cd web
npm run invites:create -- --count 40 --base-url http://localhost:5174
```

## 系統架構

```
┌─────────────┐   HTTPS    ┌──────────────────┐   HTTPS    ┌─────────────────────┐
│  Browser    │ ─────────▶ │  Next.js server  │ ─────────▶ │  LLM gateway        │
│  /eval      │            │  (App Router)    │            │  (OpenAI 相容       │
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

瀏覽器 **絕不** 接觸 gateway API key 或隱藏的 A/B/C ↔ 真實模型對應表。所有 gateway 呼叫都在 server 端進行。受測者資料、邀請碼、後台設定全部存於 `web/.data/` 內的 JSON 檔（已 gitignore）。

## 文件

- [docs/USAGE.en.md](./docs/USAGE.en.md) — 完整 setup、受測者 + 後台流程、API reference（English）
- [docs/USAGE.zh-TW.md](./docs/USAGE.zh-TW.md) — 同上，繁體中文版

## 專案結構

```
eval-ui/
├── web/                 # 目前使用的 Next.js app
├── openspec/            # Spec-driven workflow：specs + 變更歷史
└── docs/                # 使用 / API 文件（EN + ZH-TW）
```

## 驗證

```bash
cd web
npm run typecheck
npm run lint
npm run build
```

## 授權

[MIT](./LICENSE) © 2026 Yung
