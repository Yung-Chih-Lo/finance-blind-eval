## Context

`ProviderSettings` 與 OpenAI-compatible gateway 的整合目前以「chat URL 為主、models URL 反推」的反向設計實作（見 `web/lib/server/provider-settings.ts:179` 的 `deriveProviderModelsEndpoint`）。實務上 admin 與部署 env 都會直覺地把 `…/v1` 當 base URL 來貼，導致 chat fetch 打到不存在的 path。整個 ecosystem（OpenAI SDK / LangChain / LiteLLM / Vercel AI SDK / Open WebUI）一致採用 base URL 模型，本 repo 屬於孤例。

stakeholder：研究人員（admin）、未來部署到其他 gateway 的接續者。受影響檔案：4 個 server-side 模組 + 1 個 client 元件 + 2 個 type/test 檔。

## Goals / Non-Goals

**Goals:**
- `ProviderSettings.apiBaseUrl` 是唯一事實來源，chat / models URL 全部由它 derive
- Validation 嚴格化：base 不可帶 `/chat/completions` 後綴、不可有 query/fragment、必須 http(s)
- Env var 命名與語義一致（`OPENAI_COMPAT_API_BASE_URL`）
- 舊 persisted schema 被讀到時 fail-loud，不靜默 migrate

**Non-Goals:**
- 不支援多 gateway / multi-tenant
- 不為 backward compatibility 提供 dual-read（env 或 stored schema 都 hard cut）
- 不引入新的 client library（仍直接 `fetch`）
- 不改動 model mapping、prompts、temperature、max tokens 的設計

## Decisions

### D1: 欄位命名

採用 `apiBaseUrl` 與 `modelsEndpointOverride`。

考慮過的替代：
- `baseUrl`：太通用，未來如果加入別種 base（如 admin auth base）會語義模糊
- `openaiBaseUrl`：把 vendor 寫死，但我們刻意保留「OpenAI-compatible」彈性
- 保留 `modelsEndpoint` 不 rename：但「override」這個語義需要明確化，避免再次被誤解為「主要設定」

### D2: URL resolver 集中在 `provider-settings.ts`

新增兩個 pure function：
```ts
resolveChatCompletionsUrl(settings: Pick<ProviderSettings, "apiBaseUrl">): string
resolveModelsEndpoint(settings: Pick<ProviderSettings, "apiBaseUrl" | "modelsEndpointOverride">): string
```

兩者都接受 trailing slash（normalize），但不接受其他「智慧」。`gateway-client.ts` 的 fetch 全部走 resolver，禁止直接讀 `apiBaseUrl` 拼字串。

### D3: Validation 規則

`validateProviderSettings` 中對 `apiBaseUrl` 新增：
- 必要時必填（依 `requireComplete` / `requireEndpoint`）
- 必須能 parse 為 `URL`、protocol 為 http: / https:
- `url.search === ""` 且 `url.hash === ""`（不容許 query / fragment）
- `url.pathname` 結尾不可為 `/chat/completions`、`/chat/completions/`、`/completions`（廣義防呆，給人「base 就是 base」明確訊號）
- 錯誤訊息：「`provider.apiBaseUrl` should be a base URL (e.g. https://gateway.example.com/v1), not the chat completions URL.」

`modelsEndpointOverride` 維持「可選的完整 URL」語義，只驗 http(s)、不限制 path。

### D4: Env var hard rename，無 fallback

`getDefaultProviderSettings()` 只讀 `OPENAI_COMPAT_API_BASE_URL`。
舊 `OPENAI_COMPAT_API_ENDPOINT` 完全忽略（即便還在 process.env）。
理由：fallback 帶來認知負擔，且現場只有單一部署點，rename 成本 = 在 Zeabur dashboard 改一個 key。

### D5: Persisted settings hard fail

`platform-settings.ts` 在 envelope load 時：
- 偵測 `envelope.provider.chatCompletionsEndpoint` 或 `envelope.provider.modelsEndpoint`（舊 key 存在）
- 拋 `PlatformSettingsError`，status 500，issues 包含「Legacy provider schema detected. Open /admin and re-save provider settings to migrate.」
- 不嘗試自動 migrate（與 D4 一致：不悄悄改人 data）

UI side：admin layout 已有「runtime settings invalid」error display path（`/api/admin/settings` 回 500），追加一條 banner 文案，給 admin 「重新儲存」與「reset to defaults」兩個動作的引導。

### D6: 不引入 `URL.canParse`

Next.js / Node 22 都支援，但保留現有 `try { new URL() }` 模式，與既有 `isValidUrl` 一致。

## Risks / Trade-offs

- **[Hard cut env var → 部署中斷 window]** → Mitigation：part of release checklist 是先在 Zeabur 設好新 key 才推 main；prod 為單一服務、重啟秒級
- **[admin 不知道要重存 provider 設定 → 看到 500 panic]** → Mitigation：error banner 文案清楚指引；README + CLAUDE.md 同步更新 migration note
- **[Validation 太嚴可能誤殺正當需求（例如某 gateway 真的需要 query string）]** → Mitigation：發生時走 `modelsEndpointOverride` 或之後再加 escape hatch；目前 YAGNI
- **[Spec.md delta 漏改 → archive 後 spec 與實作脫鉤]** → Mitigation：tasks 顯式列出 spec 更新；apply 後 `openspec validate --strict` 把關

## Migration Plan

1. **部署前**：在 Zeabur dashboard 新增 env `OPENAI_COMPAT_API_BASE_URL=https://owui-llm.vixight.com/v1`（與舊值相同就行；不刪舊 key，等部署成功再清）
2. **推 main / Zeabur auto deploy**
3. **第一次開 `/admin`** → provider 分頁 banner 跳出 → 點 reset to defaults（會吃新 env）或手動把舊 form 欄位重新填一次後 save
4. **驗證**：QR 路徑可用、`/api/admin/provider/models` 200、產一題完整 5 題評測流程
5. **清掉 Zeabur 舊 env `OPENAI_COMPAT_API_ENDPOINT`**

**Rollback**：`git revert` PR + Zeabur 把舊 env key 加回來；persisted settings 因為 hard fail 已被 admin reset，但 reset 後仍為 default shape，回到舊 code 仍能正常從 env 載入。
