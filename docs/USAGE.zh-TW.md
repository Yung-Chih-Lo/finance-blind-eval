# 使用 & API 文件（繁體中文）

> English: [USAGE.en.md](./USAGE.en.md)

本文件涵蓋：環境設置、受測者流程、研究後台、以及 API 介面 — 包括 **Next.js server 怎麼接到 LLM gateway 後端**，以及 **app 自己對外開的 HTTP endpoints**。

---

## 1. 前置條件

- Node.js ≥ 20（Next.js 16 需求）
- 一個 **OpenAI 相容的 chat-completions endpoint**，並至少提供三個模型。已測試過 vLLM / TGI / llama.cpp / OpenAI proxy gateways — 只要能回應 `POST /v1/chat/completions` 跟 `GET /v1/models` 都可以
- Next.js server 能網路連通到該 endpoint（LAN、public、或 `localhost` 都行）

---

## 2. 環境變數設定

所有 env vars 都是 **server-only**，放在 `web/.env.local`。**絕對不要** 加 `NEXT_PUBLIC_*` 前綴的秘密 — 那會洩漏到瀏覽器 bundle。

```bash
# LLM gateway — 只填 base URL（不要包含 /chat/completions）。
# 後端會自動 derive `${base}/chat/completions` 與 `${base}/models`。
OPENAI_COMPAT_API_BASE_URL=http://127.0.0.1:8080/v1
OPENAI_COMPAT_API_KEY=sk-...                # 如果 gateway 開放可以不填
OPENAI_COMPAT_API_KEY_ENV=OPENAI_COMPAT_API_KEY
OPENAI_COMPAT_MODELS_ENDPOINT=              # 選填；預設 ${OPENAI_COMPAT_API_BASE_URL}/models
OPENAI_COMPAT_TEMPERATURE=0.2
OPENAI_COMPAT_MAX_TOKENS=1200

# 選填：指定使用的三個模型；不填則由後台從 /v1/models 挑選
OPENAI_COMPAT_MODEL_H1=
OPENAI_COMPAT_MODEL_H2=
OPENAI_COMPAT_MODEL_TAIDE=

# 選填：預設 prompt（後台 UI 可在 runtime 覆寫）
OPENAI_COMPAT_SYSTEM_PROMPT=
OPENAI_COMPAT_USER_PROMPT_TEMPLATE=

# 後台認證
ADMIN_LINK_TOKEN=<隨機 32+ 字元 token>            # magic-link URL 用的明文 token
ADMIN_LINK_TOKEN_SHA256=<上者的 sha256>           # 用於 constant-time 比對
ADMIN_SESSION_SECRET=<隨機 32+ 字元>              # 簽 admin session cookie
ADMIN_PASSWORD=<basic-auth 密碼>                  # token 流程不可用時的 fallback

# Runtime 設定檔（選填覆寫路徑）
PLATFORM_SETTINGS_FILE=                            # 預設 web/.data/platform-settings.json
EVALUATION_DATA_FILE=                              # 預設 web/.data/evaluation-store.json
```

一次性產生 admin token + SHA-256：

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

## 3. 本機啟動

```bash
cd web
npm install
npm run dev -- --port 5174
```

驗證指令：

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build
```

---

## 4. 受測者流程（`/eval`）

```
邀請碼  →  Profile 表單  →  Q1 ... QN  →  完成頁
```

1. **邀請**：研究者交給受測者一組邀請碼（或 QR code 對應 `/eval?invite=<code>`）
2. **兌換**：`/eval` 把邀請碼換成匿名 participant token + httpOnly session cookie。一組碼只能用一次（`maxUses` 可調）
3. **Profile**：受測者填基本背景（金融 / 非金融、熟悉度 1–5、LLM 使用經驗等），存入 participant record
4. **每一題**：受測者輸入金融問題。Server：
   - 從 runtime settings 挑 3 個模型
   - 平行呼叫 gateway 3 次
   - 把三份答案打亂後貼上 A / B / C 標籤；對應表 `A→modelX`, `B→modelY`, `C→modelZ` **僅存在 server**
   - 回傳 `{A, B, C}` 文字到瀏覽器
5. **判斷**：受測者選 (a) 整體最佳、(b) 整體最差、(c) 各 facet（correctness / reasoning / completeness / readability）最佳，(d) 選填理由文字 + worst-answer flags
6. **重複** 到達設定的最大題數，然後 `/completion`

瀏覽器永遠看不到模型 ID。對應表只出現在 `evaluation-store.json` 跟後台匯出。

---

## 5. 研究後台（`/admin`）

後台網址是 **magic link**：

```
https://your.domain/admin?token=<ADMIN_LINK_TOKEN>
```

Server 用 constant-time 比對 `ADMIN_LINK_TOKEN_SHA256`，設 `admin_session` cookie（用 `ADMIN_SESSION_SECRET` 簽），然後 redirect 到 `/admin` 不留 token 在 URL。Magic link 不能用時 `ADMIN_PASSWORD` 可走 Basic Auth fallback。

後台是 **sidebar dashboard**，七個 tab（可用 `?tab=<id>` 直達）：

| Tab id | 用途 |
|---|---|
| `overview` | 受測流程漏斗（Invited → Redeemed → Profile → Answered → Completed）、worst-answer-flag top 3、延遲離群（> p95）、停滯受測者、模型 leaderboard（按 net = best − worst 排序） |
| `participants` | 每個 token 一列：背景、金融熟悉度、LLM 經驗、完成狀態、完成題數 / 上限 |
| `models` | Leaderboard + 各 facet 的 best/worst/net 比較表 + worst-flag 統計 |
| `invites` | 邀請碼用量摘要 + 新增邀請碼 |
| `provider` | 可編輯：API base URL、可選 models endpoint override、從 `/v1/models` 挑模型、system prompt、user prompt template、temperature、max tokens；附「測試呼叫」**不會** 寫紀錄 |
| `study-copy` | 可編輯受測者端文案：開頭信、prompt 類別、範例題、簽名 metadata、完成頁文字 |
| `records` | 每題紀錄表（token · # · 題型 · best · worst · latency）；點任一列 → 側邊抽屜顯示完整題目、facet 選擇、worst-answer flags、隱藏對應表、理由文字 |

Sidebar 可收（左上 toggle）。Content 區獨立滾動、header 固定。

---

## 6. Next.js 怎麼接到 LLM gateway

### 呼叫發生在哪

`web/lib/server/answer-generation.ts` 跟它的 caller `app/api/evaluation/answers/route.ts`。流程：

1. 讀 **active platform settings**（file-backed；後台 runtime 可覆寫）
2. 解析三個目標模型 ID（從 `OPENAI_COMPAT_MODEL_*` env vars，或後台選的模型名）
3. 對每個模型組 request body：
   ```json
   {
     "model": "<modelId>",
     "messages": [
       { "role": "system", "content": "<settings 的 system prompt>" },
       { "role": "user",   "content": "<填好題目的 user prompt template>" }
     ],
     "temperature": 0.2,
     "max_tokens": 1200
   }
   ```
4. `POST` 到 `${OPENAI_COMPAT_API_BASE_URL}/chat/completions`，header `Authorization: Bearer ${process.env[OPENAI_COMPAT_API_KEY_ENV]}`（後台 UI 只存 env var **名稱**，永遠不存明文 key）
5. 等三個回應、量延遲、隨機打亂 A/B/C 標籤順序
6. **只** 回 `{ A: "...", B: "...", C: "..." }` + 一個 pending-question ID 給瀏覽器。對應表留在 server

### 模型探索

後台「Provider 設定」tab 呼叫 **`GET /api/admin/provider/models`**，server 端代理一個請求到 `OPENAI_COMPAT_MODELS_ENDPOINT`（預設 `${OPENAI_COMPAT_API_BASE_URL}/models`）。回應是 gateway 的 `data: [{ id: "..." }]`，做成下拉選單讓後台把三個 model ID pin 到 H1 / H2 / TAIDE 三個 slot。

### Provider 試打（不寫資料庫）

`POST /api/admin/provider/test` 帶一個範例題，會跑一次 generation **但不寫** participant record。改 prompt 後開放邀請前用這個確認。

### 設定熱更新

`PUT /api/admin/settings` 寫 `web/.data/platform-settings.json` + 把 `settingsVersion` 加 1。下一次 generation 立刻吃新設定。舊紀錄會帶著當時的 `settingsVersion` + `settingsSnapshotHash`，分析時可重建。

---

## 7. API reference（HTTP endpoints）

全部都是 Next.js Route Handlers，在 `web/app/api/` 底下。**所有 admin route 需要 `admin_session` cookie**（或 Basic Auth fallback）。Participant route 需要 `/api/session/redeem-invite` 發的 participant session cookie。

### 受測者 routes

| Method · Path | 用途 |
|---|---|
| `POST /api/session/redeem-invite` | 邀請碼換 participant token + session cookie。Body：`{ invite }` |
| `GET  /api/session` | 讀目前 participant session（token + 狀態） |
| `POST /api/session/token` | 重新整理 / 輪替 participant session |
| `POST /api/evaluation/answers` | 為新題目生成三份答案。Body：`{ userQuestion, promptCategory }`。回傳 `{ pendingQuestionId, answers: {A,B,C} }` |
| `POST /api/evaluation/records` | 提交受測者判斷。Body：`{ pendingQuestionId, selectedBest, selectedWorst, facetSelections, worstAnswerFlags?, bestReason?, worstReason? }` |

### 後台 routes

| Method · Path | 用途 |
|---|---|
| `GET  /api/admin/auth/exchange` | Magic-link → cookie 換取（被 `/admin?token=...` 呼叫） |
| `POST /api/admin/auth/logout` | 清 `admin_session` cookie |
| `GET  /api/admin/records` | 回傳完整 `AdminSnapshot`（participants, records, model counts, funnel, attention items） |
| `GET  /api/admin/export?format=json` | 下載 JSON 格式評估資料 |
| `GET  /api/admin/export?format=csv` | 下載 CSV 格式評估資料（每題一列） |
| `POST /api/admin/invites` | 產生 N 組邀請碼 + QR SVG。Body：`{ count, baseUrl, label? }` |
| `GET  /api/admin/settings` | 讀目前 platform settings |
| `PUT  /api/admin/settings` | 寫 / 覆蓋 platform settings。Body：完整 `StudyConfig` envelope |
| `POST /api/admin/settings/reset` | 重置成 repo 預設（`web/config/evaluation.config.json`） |
| `GET  /api/admin/settings/export` | 下載目前 platform settings 為 JSON |
| `GET  /api/admin/provider/models` | 代理 `GET /v1/models` 供模型選單 |
| `POST /api/admin/provider/test` | 試打 generation（**不寫** records） |

---

## 8. 儲存結構

```
web/.data/
├── evaluation-store.json          # 所有 participants / records / invites / sessions
├── platform-settings.json         # runtime study config（帶版本）
└── invite-qr/
    ├── invites.csv                # 產生的碼 + 兌換 URL
    └── <code>.svg                 # 每組碼一個 QR
```

`web/.data/` 在 **`.gitignore` 內**，因為含 participant PII 跟有效邀請碼。當成 production database 看 — 定期備份（`cp -r web/.data/ backups/$(date +%Y%m%d)/`）。

需要把資料指向 production volume 時，可用 `PLATFORM_SETTINGS_FILE` 跟 `EVALUATION_DATA_FILE` env vars 覆寫路徑。

---

## 9. 部署備註

- Next.js app 在 framework 層是 stateless，但透過 disk JSON store 是 stateful。多實例部署要把 JSON store 放到共用 volume，或把 `evaluation-storage.ts` 換成真資料庫（這個 module 是單一邊界，容易替換）
- Gateway endpoint 放哪都行（只要 server 連得到）。常見模式：eval app 部署在研究者控制的主機、LLM gateway 跑在 GPU 節點、gateway 限制只接受 eval host 的 IP
- HTTPS：放在反向代理後面（nginx / Caddy / Cloudflare）。Cookie 在 production 是 `Secure` + `SameSite=Lax`

---

## 10. 開邀請前的驗收清單

1. `npm run build` 在部署主機過
2. `GET /api/admin/provider/models` 回傳預期的 model list
3. `POST /api/admin/provider/test` 用範例題在 `OPENAI_COMPAT_MAX_TOKENS` 預算內回三份答案
4. 產一組邀請、用無痕視窗兌換、完整答完一題、回 `/admin?tab=records` 確認紀錄出現
5. 匯出 JSON + CSV，確認 `hidden_mapping_*` 欄位有真實模型 ID

1–5 都過才能開放邀請。
