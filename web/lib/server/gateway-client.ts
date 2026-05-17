import "server-only"

import { MODEL_IDS } from "@/lib/evaluation/config"
import type {
  AnswerGenerationResult,
  AnswerLabel,
  ModelId,
  PromptCategory,
  ProviderModelDiscoveryResult,
  ProviderPreviewResult,
  ProviderSettings,
} from "@/lib/evaluation/types"
import {
  assertValidProviderSettings,
  createProviderSettingsStatus,
  getDefaultProviderSettings,
  getProviderApiKey,
  renderProviderUserPrompt,
  resolveChatCompletionsUrl,
  resolveModelsEndpoint,
} from "@/lib/server/provider-settings"

const MODEL_HINTS: Record<ModelId, RegExp[]> = {
  "H1-best": [/h1/i, /apt/i],
  "H2-best": [/h2/i, /slp/i],
  "TAIDE-baseline": [/taide/i, /baseline/i],
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
    text?: string
  }>
}

interface ModelListResponse {
  data?: Array<{
    id?: string
  }>
}

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function shuffleModels(modelIds: ModelId[], seed: string): ModelId[] {
  const values = [...modelIds]
  let state = hashSeed(seed)

  for (let index = values.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0
    const swapIndex = state % (index + 1)
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }

  return values
}

function getAuthHeaders(settings: ProviderSettings, includeContentType = false): Record<string, string> {
  const headers: Record<string, string> = {}
  if (includeContentType) {
    headers["Content-Type"] = "application/json"
  }
  const apiKey = getProviderApiKey(settings)
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

function getModelOverrides(): Partial<Record<ModelId, string>> {
  return {
    "H1-best": process.env.OPENAI_COMPAT_MODEL_H1,
    "H2-best": process.env.OPENAI_COMPAT_MODEL_H2,
    "TAIDE-baseline": process.env.OPENAI_COMPAT_MODEL_TAIDE,
  }
}

function inferModelName(modelId: ModelId, availableModelIds: string[], used: Set<string>): string | undefined {
  const override = getModelOverrides()[modelId]
  if (override) {
    return override
  }

  return availableModelIds.find((candidate) => {
    if (used.has(candidate)) {
      return false
    }
    return MODEL_HINTS[modelId].some((pattern) => pattern.test(candidate))
  })
}

export function buildGatewayModelMapping(
  availableModelIds: string[],
  modelIds: ModelId[] = MODEL_IDS,
): Record<ModelId, string> {
  const used = new Set<string>()
  const mapping = {} as Record<ModelId, string>

  modelIds.forEach((modelId) => {
    const matched = inferModelName(modelId, availableModelIds, used)
    if (matched) {
      mapping[modelId] = matched
      used.add(matched)
    }
  })

  if (availableModelIds.length === modelIds.length) {
    modelIds.forEach((modelId, index) => {
      if (!mapping[modelId]) {
        const fallback = availableModelIds.find((candidate) => !used.has(candidate)) ?? availableModelIds[index]
        mapping[modelId] = fallback
        used.add(fallback)
      }
    })
  }

  const missing = modelIds.filter((modelId) => !mapping[modelId])
  if (missing.length > 0) {
    throw new Error(
      [
        `/v1/models returned ${availableModelIds.length} models but could not map ${missing.join(", ")}.`,
        "Set OPENAI_COMPAT_MODEL_H1, OPENAI_COMPAT_MODEL_H2, and OPENAI_COMPAT_MODEL_TAIDE when the gateway exposes more than three models or names are ambiguous.",
      ].join(" "),
    )
  }

  return mapping
}

export async function discoverProviderModels(settings: ProviderSettings): Promise<ProviderModelDiscoveryResult> {
  const startedAt = performance.now()
  const readySettings = assertValidProviderSettings(settings, {
    requireEndpoint: true,
    requireApiKeyConfigured: true,
  })
  const endpoint = resolveModelsEndpoint(readySettings)
  if (!endpoint) {
    throw new Error("Models endpoint is not configured.")
  }

  const response = await fetch(endpoint, {
    headers: getAuthHeaders(readySettings),
    cache: "no-store",
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Models endpoint ${response.status}: ${detail.slice(0, 240)}`)
  }

  const data = (await response.json()) as ModelListResponse
  const availableModelIds = data.data?.map((model) => model.id).filter((id): id is string => Boolean(id)) ?? []
  return {
    endpoint,
    modelIds: availableModelIds,
    latencyMs: Math.round(performance.now() - startedAt),
    apiKeyConfigured: createProviderSettingsStatus(readySettings).apiKeyConfigured,
  }
}

async function getGatewayModelNames(settings: ProviderSettings, targetModelIds: ModelId[]): Promise<Record<ModelId, string>> {
  const explicitMapping = Object.fromEntries(
    targetModelIds
      .map((modelId) => [modelId, settings.modelMapping[modelId]?.trim()])
      .filter((entry): entry is [ModelId, string] => Boolean(entry[1])),
  ) as Partial<Record<ModelId, string>>
  if (targetModelIds.every((modelId) => explicitMapping[modelId])) {
    return explicitMapping as Record<ModelId, string>
  }

  const discovery = await discoverProviderModels(settings)
  const availableModelIds = discovery.modelIds
  if (availableModelIds.length < targetModelIds.length) {
    throw new Error(
      `/v1/models must return at least ${targetModelIds.length} models. It returned ${availableModelIds.length}.`,
    )
  }
  return buildGatewayModelMapping(availableModelIds, targetModelIds)
}

async function requestGatewayAnswer(params: {
  settings: ProviderSettings
  gatewayModelName: string
  category: PromptCategory
  question: string
}): Promise<string> {
  const response = await fetch(resolveChatCompletionsUrl(params.settings), {
    method: "POST",
    headers: getAuthHeaders(params.settings, true),
    body: JSON.stringify({
      model: params.gatewayModelName,
      temperature: params.settings.temperature,
      max_tokens: params.settings.maxTokens,
      messages: [
        {
          role: "system",
          content: params.settings.systemPrompt,
        },
        {
          role: "user",
          content: renderProviderUserPrompt(params.settings.userPromptTemplate, {
            categoryTitle: params.category.title,
            categoryInstruction: params.category.instruction,
            question: params.question,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`LLM endpoint ${response.status}: ${detail.slice(0, 240)}`)
  }

  const data = (await response.json()) as ChatCompletionResponse
  const answer = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text
  if (!answer?.trim()) {
    throw new Error("LLM endpoint response is missing choices[0].message.content.")
  }

  return answer.trim()
}

export async function generateBlindAnswers(params: {
  answerLabels: AnswerLabel[]
  modelIds: ModelId[]
  providerSettings?: ProviderSettings
  participantToken: string
  questionIndex: number
  category: PromptCategory
  question: string
}): Promise<AnswerGenerationResult> {
  const startedAt = performance.now()
  const orderedModels = shuffleModels(
    params.modelIds,
    `${params.participantToken}:${params.questionIndex}:${params.category.id}:${params.question}`,
  )
  const providerSettings = assertValidProviderSettings(params.providerSettings ?? getDefaultProviderSettings(), {
    requireEndpoint: true,
    requireApiKeyConfigured: true,
  })
  if (!providerSettings.apiBaseUrl) {
    throw new Error("模型服務尚未連線：缺少 OPENAI_COMPAT_API_BASE_URL。請通知研究人員。")
  }

  const gatewayModelNames = await getGatewayModelNames(providerSettings, params.modelIds)
  const answersByModel = await Promise.all(
    orderedModels.map(async (modelId) => ({
      modelId,
      text: await requestGatewayAnswer({
        settings: providerSettings,
        gatewayModelName: gatewayModelNames[modelId],
        category: params.category,
        question: params.question,
      }),
    })),
  )

  const answers = {} as Record<AnswerLabel, string>
  const hiddenModelMapping = {} as Record<AnswerLabel, ModelId>
  const gatewayModelMapping = {} as Record<AnswerLabel, string>

  answersByModel.forEach((answer, index) => {
    const label = params.answerLabels[index]
    answers[label] = answer.text
    hiddenModelMapping[label] = answer.modelId
    gatewayModelMapping[label] = gatewayModelNames[answer.modelId]
  })

  return {
    answers,
    hiddenModelMapping,
    gatewayModelMapping,
    latencyMs: Math.round(performance.now() - startedAt),
  }
}

export async function previewProviderAnswers(params: {
  providerSettings: ProviderSettings
  answerLabels: AnswerLabel[]
  modelIds: ModelId[]
  category: PromptCategory
  question: string
}): Promise<ProviderPreviewResult> {
  const startedAt = performance.now()
  const providerSettings = assertValidProviderSettings(params.providerSettings, {
    requireComplete: true,
    requireApiKeyConfigured: true,
  })
  const gatewayModelNames = await getGatewayModelNames(providerSettings, params.modelIds)
  const candidates = await Promise.all(
    params.modelIds.map(async (modelId, index) => {
      const candidateStartedAt = performance.now()
      const text = await requestGatewayAnswer({
        settings: providerSettings,
        gatewayModelName: gatewayModelNames[modelId],
        category: params.category,
        question: params.question,
      })
      return {
        label: params.answerLabels[index],
        internalModelId: modelId,
        gatewayModelName: gatewayModelNames[modelId],
        text,
        latencyMs: Math.round(performance.now() - candidateStartedAt),
      }
    }),
  )

  return {
    question: params.question,
    candidates,
    latencyMs: Math.round(performance.now() - startedAt),
  }
}
