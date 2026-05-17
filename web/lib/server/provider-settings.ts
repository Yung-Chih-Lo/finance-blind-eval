import "server-only"

import type { ModelId, ProviderSettings, ProviderSettingsStatus } from "@/lib/evaluation/types"

const MODEL_IDS: ModelId[] = ["H1-best", "H2-best", "TAIDE-baseline"]
const DEFAULT_API_KEY_ENV_VAR = "OPENAI_COMPAT_API_KEY"
const DEFAULT_SYSTEM_PROMPT =
  "你是金融問答模型。請用繁體中文回答受測者問題，保持專業、清楚、可比較。不要提到模型名稱、盲測、A/B/C 或你正在被評估。"
const DEFAULT_USER_PROMPT_TEMPLATE = [
  "題型：{{categoryTitle}}",
  "參考方向：{{categoryInstruction}}",
  "受測者問題：{{question}}",
].join("\n")

export class ProviderSettingsError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
    readonly status = 400,
  ) {
    super(message)
    this.name = "ProviderSettingsError"
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function envString(name: string) {
  return process.env[name]?.trim() ?? ""
}

function optionalNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeModelMapping(value: unknown): Record<ModelId, string> {
  const mapping = isObject(value) ? value : {}
  return {
    "H1-best": typeof mapping["H1-best"] === "string" ? mapping["H1-best"].trim() : "",
    "H2-best": typeof mapping["H2-best"] === "string" ? mapping["H2-best"].trim() : "",
    "TAIDE-baseline": typeof mapping["TAIDE-baseline"] === "string" ? mapping["TAIDE-baseline"].trim() : "",
  }
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function validateOptionalUrl(value: string, path: string, issues: string[], options: { required?: boolean } = {}) {
  if (!value) {
    if (options.required) {
      issues.push(`${path} must be a valid http(s) URL.`)
    }
    return
  }
  if (!isValidUrl(value)) {
    issues.push(`${path} must be a valid http(s) URL.`)
  }
}

export function getDefaultProviderSettings(): ProviderSettings {
  return {
    apiBaseUrl: envString("OPENAI_COMPAT_API_BASE_URL"),
    modelsEndpointOverride: envString("OPENAI_COMPAT_MODELS_ENDPOINT"),
    apiKeyEnvVar: envString("OPENAI_COMPAT_API_KEY_ENV") || DEFAULT_API_KEY_ENV_VAR,
    modelMapping: {
      "H1-best": envString("OPENAI_COMPAT_MODEL_H1"),
      "H2-best": envString("OPENAI_COMPAT_MODEL_H2"),
      "TAIDE-baseline": envString("OPENAI_COMPAT_MODEL_TAIDE"),
    },
    systemPrompt: envString("OPENAI_COMPAT_SYSTEM_PROMPT") || DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: envString("OPENAI_COMPAT_USER_PROMPT_TEMPLATE") || DEFAULT_USER_PROMPT_TEMPLATE,
    temperature: optionalNumber(process.env.OPENAI_COMPAT_TEMPERATURE, 0.2),
    maxTokens: optionalNumber(process.env.OPENAI_COMPAT_MAX_TOKENS, 1200),
  }
}

export function normalizeProviderSettings(value: unknown, fallback = getDefaultProviderSettings()): ProviderSettings {
  if (!isObject(value)) {
    return structuredClone(fallback)
  }

  return {
    apiBaseUrl: typeof value.apiBaseUrl === "string" ? value.apiBaseUrl.trim() : "",
    modelsEndpointOverride:
      typeof value.modelsEndpointOverride === "string" ? value.modelsEndpointOverride.trim() : "",
    apiKeyEnvVar: typeof value.apiKeyEnvVar === "string" ? value.apiKeyEnvVar.trim() : fallback.apiKeyEnvVar,
    modelMapping: normalizeModelMapping(value.modelMapping),
    systemPrompt: typeof value.systemPrompt === "string" ? value.systemPrompt : fallback.systemPrompt,
    userPromptTemplate:
      typeof value.userPromptTemplate === "string" ? value.userPromptTemplate : fallback.userPromptTemplate,
    temperature: Number.isFinite(Number(value.temperature)) ? Number(value.temperature) : fallback.temperature,
    maxTokens: Number.isInteger(Number(value.maxTokens)) ? Number(value.maxTokens) : fallback.maxTokens,
  }
}

export function validateProviderSettings(
  value: unknown,
  options: { requireComplete?: boolean; requireEndpoint?: boolean; requireApiKeyConfigured?: boolean } = {},
) {
  const settings = normalizeProviderSettings(value)
  const issues: string[] = []
  const requireComplete = options.requireComplete ?? false

  validateOptionalUrl(settings.apiBaseUrl, "provider.apiBaseUrl", issues, {
    required: requireComplete || options.requireEndpoint,
  })
  validateApiBaseUrlSemantics(settings.apiBaseUrl, issues)
  validateOptionalUrl(settings.modelsEndpointOverride, "provider.modelsEndpointOverride", issues)

  if (!/^[A-Z_][A-Z0-9_]*$/.test(settings.apiKeyEnvVar)) {
    issues.push("provider.apiKeyEnvVar must be an uppercase environment variable name.")
  }

  MODEL_IDS.forEach((modelId) => {
    if (requireComplete && !settings.modelMapping[modelId]) {
      issues.push(`provider.modelMapping.${modelId} must be selected.`)
    }
  })

  if (!settings.systemPrompt.trim()) {
    issues.push("provider.systemPrompt must be a non-empty string.")
  }
  if (!settings.userPromptTemplate.trim()) {
    issues.push("provider.userPromptTemplate must be a non-empty string.")
  }
  if (requireComplete && !settings.userPromptTemplate.includes("{{question}}")) {
    issues.push("provider.userPromptTemplate must include {{question}}.")
  }
  if (!Number.isFinite(settings.temperature) || settings.temperature < 0 || settings.temperature > 2) {
    issues.push("provider.temperature must be between 0 and 2.")
  }
  if (!Number.isInteger(settings.maxTokens) || settings.maxTokens < 64 || settings.maxTokens > 16000) {
    issues.push("provider.maxTokens must be an integer between 64 and 16000.")
  }
  if (options.requireApiKeyConfigured && !getProviderApiKey(settings)) {
    issues.push(`provider.apiKeyEnvVar ${settings.apiKeyEnvVar} is not configured on the server.`)
  }

  return {
    ok: issues.length === 0,
    issues,
    settings,
  }
}

export function assertValidProviderSettings(
  value: unknown,
  options: { requireComplete?: boolean; requireEndpoint?: boolean; requireApiKeyConfigured?: boolean } = {},
): ProviderSettings {
  const validation = validateProviderSettings(value, options)
  if (!validation.ok) {
    throw new ProviderSettingsError("Provider settings validation failed.", validation.issues, 400)
  }
  return validation.settings
}

export function getProviderApiKey(settings: ProviderSettings) {
  return process.env[settings.apiKeyEnvVar]?.trim() ?? ""
}

export function createProviderSettingsStatus(settings: ProviderSettings): ProviderSettingsStatus {
  const mappedModelCount = MODEL_IDS.filter((modelId) => Boolean(settings.modelMapping[modelId])).length
  return {
    apiKeyEnvVar: settings.apiKeyEnvVar,
    apiKeyConfigured: Boolean(getProviderApiKey(settings)),
    hasCompleteModelMapping: mappedModelCount === MODEL_IDS.length,
    mappedModelCount,
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

export function resolveChatCompletionsUrl(settings: Pick<ProviderSettings, "apiBaseUrl">): string {
  const base = stripTrailingSlash(settings.apiBaseUrl.trim())
  if (!base) {
    throw new Error("Cannot resolve chat completions URL: apiBaseUrl is empty.")
  }
  return `${base}/chat/completions`
}

export function resolveModelsEndpoint(
  settings: Pick<ProviderSettings, "apiBaseUrl" | "modelsEndpointOverride">,
): string {
  const override = settings.modelsEndpointOverride.trim()
  if (override) {
    return override
  }
  const base = stripTrailingSlash(settings.apiBaseUrl.trim())
  if (!base) {
    throw new Error("Cannot resolve models endpoint: apiBaseUrl is empty and no modelsEndpointOverride is set.")
  }
  return `${base}/models`
}

// `apiBaseUrl` follows the OpenAI SDK base-URL convention (paste `…/v1`; server appends
// `/chat/completions` and `/models`). Reject suffixes that suggest the admin pasted a full
// chat URL by mistake — every OpenAI-compatible client we target derives the chat path from
// the base, so a base ending with `/chat/completions` or the legacy `/completions` is wrong.
function validateApiBaseUrlSemantics(value: string, issues: string[]) {
  const trimmed = value.trim()
  if (!trimmed) {
    return
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return
  }
  if (/\/(chat\/completions|completions)\/?$/.test(url.pathname)) {
    issues.push(
      "provider.apiBaseUrl should be a base URL (e.g. https://gateway.example.com/v1), not the chat completions URL.",
    )
  }
  if (url.search !== "") {
    issues.push("provider.apiBaseUrl must not include a query string.")
  }
  if (url.hash !== "") {
    issues.push("provider.apiBaseUrl must not include a fragment.")
  }
}

export function renderProviderUserPrompt(
  template: string,
  values: { categoryTitle: string; categoryInstruction: string; question: string },
) {
  return template
    .replaceAll("{{categoryTitle}}", values.categoryTitle)
    .replaceAll("{{categoryInstruction}}", values.categoryInstruction)
    .replaceAll("{{question}}", values.question)
}
