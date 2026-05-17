## Why

目前 provider 設定的 `chatCompletionsEndpoint` 欄位要求 admin 輸入完整 chat URL（`…/v1/chat/completions`），而 models endpoint 則從 chat URL 反推（strip `/chat/completions` → 換 `/models`）。這違反業界慣例：OpenAI SDK、LangChain、LiteLLM、Vercel AI SDK、Open WebUI 都採用「base URL，client 內部 append paths」。

實際後果：Zeabur 部署時 `OPENAI_COMPAT_API_ENDPOINT` 被直覺地設成 `https://owui-llm.vixight.com/v1`，造成 `GET /v1/models` 200（derive 邏輯剛好把 base + `/models` 拼對）但 `POST /v1` 404（chat 直接打原值，沒接 `/chat/completions`）。

## What Changes

- **BREAKING**: `ProviderSettings.chatCompletionsEndpoint` 改名為 `apiBaseUrl`；`ProviderSettings.modelsEndpoint` 改名為 `modelsEndpointOverride`
- **BREAKING**: env var `OPENAI_COMPAT_API_ENDPOINT` 改名為 `OPENAI_COMPAT_API_BASE_URL`（無 fallback；舊 env 無效）
- **BREAKING**: 舊 persisted `platform-settings.json` 含 `provider.chatCompletionsEndpoint` 在 load 時 hard fail，admin UI 顯示 banner 提示重存或 reset
- Chat URL 統一 derive：`${apiBaseUrl}/chat/completions`
- Models URL 統一 derive：`modelsEndpointOverride || ${apiBaseUrl}/models`
- Validation 嚴格化：`apiBaseUrl` 必須 http(s)、結尾不可為 `/chat/completions`、不可含 query string 或 fragment
- Admin UI：欄位 label 改為「API base URL」、placeholder 改為 `https://gateway.example.com/v1`、新增 helper text 明確說明「請勿包含 /chat/completions」
- 移除 `provider-settings.ts` 中的 `deriveProviderModelsEndpoint` chat-URL-strip 智慧邏輯

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `blind-evaluation-app`: 「Gateway model discovery」requirement 移除 `/chat/completions` → `/models` 反推邏輯；新增 base-URL-driven derive 邏輯與 base URL 驗證 scenarios；「Persistent runtime settings」requirement 新增 legacy schema hard fail scenario

## Impact

**Code**:
- `web/lib/evaluation/types.ts` — `ProviderSettings` field rename
- `web/lib/server/provider-settings.ts` — rename、新增 URL resolver、validation、移除舊 derive 邏輯
- `web/lib/server/gateway-client.ts` — chat fetch 改用 resolver；env var rename；error message 文案
- `web/lib/server/platform-settings.ts` — load 時偵測 legacy `chatCompletionsEndpoint` 並 `PlatformSettingsError`
- `web/components/evaluation/admin-provider-settings.tsx` — 欄位 rename、label/placeholder/helper text、legacy schema banner
- `web/tests/provider-settings-typecheck.ts` — fixture 更新

**Env / Ops**:
- Zeabur env var rename：`OPENAI_COMPAT_API_ENDPOINT` → `OPENAI_COMPAT_API_BASE_URL`（部署後手動處理）
- 部署後 admin 需至 `/admin` provider 分頁重新儲存設定（一次性 migration）

**Docs**:
- `CLAUDE.md` env var 段落
- `web/README.md` Gateway Env 段落
- `openspec/specs/blind-evaluation-app/spec.md`（透過 archive delta）
