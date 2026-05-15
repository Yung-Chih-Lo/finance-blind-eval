# Finance Blind Evaluation UI

研究問卷式 blind evaluation 原型，用於比較三個金融問答模型的回答品質。受測者透過 token invite link 進入，例如 `/eval?token=A013`，不需要註冊帳號。

## Flow

1. 受測者輸入或由 URL 帶入 token。
2. 填寫基本背景：商學院 / 金融背景、年級或職業、是否修過金融課程、金融熟悉程度、LLM 使用經驗。
3. 依序完成 5 題 guided flexible prompt。
4. 每題產生回答 A / B / C，前端不顯示模型身份。
5. 受測者選最好、最差，填寫原因與品質量表。
6. 完成後只顯示感謝頁，不揭露模型結果。

## Admin

後台入口：`/admin`

目前資料先存在 browser `localStorage`，支援：

- 查看受測者完成狀態
- 查看每題紀錄與 hidden model mapping
- 統計每個模型被選為 best / worst 的次數
- 依金融背景顯示基本分組數
- 匯出 JSON / CSV

## Model Adapter

目前 `src/modelAdapter.ts` 支援兩種模式：

- 未設定 endpoint：使用本地 mock answer，讓 UI 與資料結構可先跑通。
- 設定 OpenAI-compatible endpoint：每題會並行呼叫三個模型，再隨機映射到回答 A / B / C。

`.env.local` 範例：

```bash
VITE_OPENAI_COMPAT_API_ENDPOINT=https://your-host.example.com/v1/chat/completions
VITE_OPENAI_COMPAT_TEMPERATURE=0.2

# Optional. 預設會由 chat endpoint 自動推導成 /v1/models。
VITE_OPENAI_COMPAT_MODELS_ENDPOINT=https://your-host.example.com/v1/models

# Optional. 只有 gateway 模型超過 3 個，或模型命名無法自動辨識時才需要。
VITE_OPENAI_COMPAT_MODEL_H1=
VITE_OPENAI_COMPAT_MODEL_H2=
VITE_OPENAI_COMPAT_MODEL_TAIDE=

# 只建議本機 demo 使用；正式部署請用 backend proxy 保護 secret。
VITE_OPENAI_COMPAT_API_KEY=
```

OpenAI-compatible response 需要回傳 `choices[0].message.content`。前端會先查 `/v1/models`，若剛好有 3 個模型，會自動映射到研究代號 `H1-best`、`H2-best`、`TAIDE-baseline`；hidden model mapping 仍會存成 `A=H2-best, B=TAIDE-baseline, C=H1-best` 這類研究記錄，不會顯示給受測者。

### Gateway FastAPI notes

你貼的 gateway 可直接使用：

```bash
VITE_OPENAI_COMPAT_API_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions
```

目前前端不使用 streaming，會先打 `/v1/models` 抓模型清單，再對三個模型並行送出 non-stream chat completion request。若 gateway 設了 `APT_API_KEY`，本機 demo 可填 `VITE_OPENAI_COMPAT_API_KEY`；正式公開受測時不要把 key 暴露在前端，應改由後端 proxy 呼叫 gateway。

如果 UI 和 gateway 不同 origin，例如 `http://127.0.0.1:5174` 呼叫 `http://127.0.0.1:8080`，FastAPI gateway 需要開 CORS，且要允許 `Authorization` 與 `Content-Type` headers，否則瀏覽器 preflight 會擋住請求。

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
