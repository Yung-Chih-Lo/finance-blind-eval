// Regression harness for provider URL resolution + base-URL validation.
// Not part of CI. Run with:
//   npm run verify:provider-url

import { strict as assert } from "node:assert"

import type { ProviderSettings } from "@/lib/evaluation/types"
import {
  getDefaultProviderSettings,
  resolveChatCompletionsUrl,
  resolveModelsEndpoint,
  validateProviderSettings,
} from "@/lib/server/provider-settings"

function baseSettings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    ...getDefaultProviderSettings(),
    apiBaseUrl: "https://x/v1",
    modelsEndpointOverride: "",
    apiKeyEnvVar: "OPENAI_COMPAT_API_KEY",
    modelMapping: { "H1-best": "a", "H2-best": "b", "TAIDE-baseline": "c" },
    systemPrompt: "s",
    userPromptTemplate: "Q: {{question}}",
    temperature: 0.2,
    maxTokens: 1200,
    ...overrides,
  }
}

assert.equal(
  resolveChatCompletionsUrl(baseSettings()),
  "https://x/v1/chat/completions",
  "chat URL from clean base",
)
assert.equal(
  resolveModelsEndpoint(baseSettings()),
  "https://x/v1/models",
  "models URL from clean base",
)

const trailing = baseSettings({ apiBaseUrl: "https://x/v1/" })
assert.equal(
  resolveChatCompletionsUrl(trailing),
  "https://x/v1/chat/completions",
  "chat URL strips trailing slash",
)
assert.equal(
  resolveModelsEndpoint(trailing),
  "https://x/v1/models",
  "models URL strips trailing slash",
)

const overrideOn = baseSettings({ modelsEndpointOverride: "https://other/m" })
assert.equal(
  resolveChatCompletionsUrl(overrideOn),
  "https://x/v1/chat/completions",
  "override does not affect chat",
)
assert.equal(
  resolveModelsEndpoint(overrideOn),
  "https://other/m",
  "override wins for models",
)

const badChatSuffix = validateProviderSettings(
  baseSettings({ apiBaseUrl: "https://x/v1/chat/completions" }),
)
assert.equal(badChatSuffix.ok, false, "reject base ending /chat/completions")
assert.ok(
  badChatSuffix.issues.some((issue: string) => issue.includes("apiBaseUrl")),
  "issue message mentions apiBaseUrl",
)

const badQuery = validateProviderSettings(baseSettings({ apiBaseUrl: "https://x/v1?foo=1" }))
assert.equal(badQuery.ok, false, "reject base with query string")

const badFragment = validateProviderSettings(baseSettings({ apiBaseUrl: "https://x/v1#frag" }))
assert.equal(badFragment.ok, false, "reject base with fragment")

console.log("verify-provider-url-resolution: all assertions passed")
