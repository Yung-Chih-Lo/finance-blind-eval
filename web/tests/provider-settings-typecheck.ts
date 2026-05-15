import type { ProviderSettings } from "@/lib/evaluation/types"
import {
  createProviderSettingsStatus,
  deriveProviderModelsEndpoint,
  getDefaultProviderSettings,
  renderProviderUserPrompt,
  validateProviderSettings,
} from "@/lib/server/provider-settings"

const defaults = getDefaultProviderSettings()

const providerSettings: ProviderSettings = {
  ...defaults,
  chatCompletionsEndpoint: "http://127.0.0.1:8080/v1/chat/completions",
  modelsEndpoint: "",
  apiKeyEnvVar: "OPENAI_COMPAT_API_KEY",
  modelMapping: {
    "H1-best": "model-a",
    "H2-best": "model-b",
    "TAIDE-baseline": "model-c",
  },
  systemPrompt: "system",
  userPromptTemplate: "Question: {{question}}",
  temperature: 0.2,
  maxTokens: 1200,
}

const validation = validateProviderSettings(providerSettings)
const status = createProviderSettingsStatus(providerSettings)
const modelsEndpoint = deriveProviderModelsEndpoint(providerSettings)
const prompt = renderProviderUserPrompt(providerSettings.userPromptTemplate, {
  categoryTitle: "金融概念理解",
  categoryInstruction: "請測試金融概念",
  question: "殖利率曲線倒掛代表什麼？",
})

validation.ok satisfies boolean
status.apiKeyConfigured satisfies boolean
modelsEndpoint satisfies string
prompt satisfies string
