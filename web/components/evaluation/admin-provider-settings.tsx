"use client"

import { Play, RefreshCw, Save, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import type {
  ActivePlatformSettings,
  ModelId,
  ProviderModelDiscoveryResult,
  ProviderPreviewResult,
  ProviderSettings,
  ProviderSettingsStatus,
} from "@/lib/evaluation/types"

interface ApiError {
  error?: string
  issues?: string[]
}

interface AdminProviderSettingsProps {
  initialSettings: ActivePlatformSettings
}

function cloneProvider(provider: ProviderSettings): ProviderSettings {
  return {
    ...provider,
    modelMapping: { ...provider.modelMapping },
  }
}

function formatIssues(data: ApiError) {
  return [data.error, ...(data.issues ?? [])].filter(Boolean).join(" ")
}

function providerMappingIsComplete(
  provider: ProviderSettings,
  modelIds: ModelId[]
) {
  return modelIds.every((modelId) =>
    Boolean(provider.modelMapping[modelId]?.trim())
  )
}

export function AdminProviderSettings({
  initialSettings,
}: AdminProviderSettingsProps) {
  const toast = useToast()
  const modelIds = initialSettings.config.modelIds
  const firstCategory = initialSettings.config.promptCategories[0]
  const [provider, setProvider] = useState(() =>
    cloneProvider(initialSettings.provider)
  )
  const [status, setStatus] = useState<ProviderSettingsStatus>(
    initialSettings.providerStatus
  )
  const [discovery, setDiscovery] =
    useState<ProviderModelDiscoveryResult | null>(null)
  const [preview, setPreview] = useState<ProviderPreviewResult | null>(null)
  const [previewQuestion, setPreviewQuestion] = useState(
    firstCategory?.examples[0] ??
      "請解釋殖利率曲線倒掛代表什麼，以及它不一定預測衰退的原因。"
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const canSave = useMemo(
    () => providerMappingIsComplete(provider, modelIds),
    [modelIds, provider]
  )
  const modelOptions = discovery?.modelIds ?? []

  function updateProviderField<K extends keyof ProviderSettings>(
    field: K,
    value: ProviderSettings[K]
  ) {
    setProvider((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateModelMapping(modelId: ModelId, gatewayModelName: string) {
    setProvider((current) => ({
      ...current,
      modelMapping: {
        ...current.modelMapping,
        [modelId]: gatewayModelName,
      },
    }))
  }

  async function saveProviderSettings() {
    setIsSaving(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      const data = (await response.json()) as ActivePlatformSettings | ApiError
      if (!response.ok) {
        throw new Error(
          formatIssues(data as ApiError) || "Provider settings save failed."
        )
      }
      const saved = data as ActivePlatformSettings
      setProvider(cloneProvider(saved.provider))
      setStatus(saved.providerStatus)
      toast.success(
        `Provider settings saved. Version v${saved.settingsVersion}.`
      )
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Provider settings save failed."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function discoverModels() {
    setIsDiscovering(true)
    try {
      const response = await fetch("/api/admin/provider/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      const data = (await response.json()) as
        | ProviderModelDiscoveryResult
        | ApiError
      if (!response.ok) {
        throw new Error(
          formatIssues(data as ApiError) || "Model discovery failed."
        )
      }
      setDiscovery(data as ProviderModelDiscoveryResult)
      toast.success(
        `Discovered ${(data as ProviderModelDiscoveryResult).modelIds.length} models.`
      )
    } catch (discoverError) {
      toast.error(
        discoverError instanceof Error
          ? discoverError.message
          : "Model discovery failed."
      )
    } finally {
      setIsDiscovering(false)
    }
  }

  async function previewProvider() {
    setIsPreviewing(true)
    setPreview(null)
    try {
      const response = await fetch("/api/admin/provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          question: previewQuestion,
          promptCategoryId: firstCategory?.id,
        }),
      })
      const data = (await response.json()) as ProviderPreviewResult | ApiError
      if (!response.ok) {
        throw new Error(
          formatIssues(data as ApiError) || "Provider preview failed."
        )
      }
      setPreview(data as ProviderPreviewResult)
      toast.success(
        `Preview completed in ${(data as ProviderPreviewResult).latencyMs} ms.`
      )
    } catch (previewError) {
      toast.error(
        previewError instanceof Error
          ? previewError.message
          : "Provider preview failed."
      )
    } finally {
      setIsPreviewing(false)
    }
  }

  return (
    <section className="table-section admin-provider-panel">
      <div className="section-heading provider-heading">
        <div>
          <p className="panel-kicker">Provider</p>
          <h2>模型服務設定</h2>
        </div>
        <div
          className={
            status.apiKeyConfigured
              ? "provider-status is-ready"
              : "provider-status is-missing"
          }
        >
          {status.apiKeyConfigured ? "API key configured" : "API key missing"}
        </div>
      </div>

      <div className="provider-grid">
        <label>
          API base URL
          <input
            value={provider.apiBaseUrl}
            placeholder="https://gateway.example.com/v1"
            onChange={(event) =>
              updateProviderField("apiBaseUrl", event.target.value)
            }
          />
          <small className="provider-helper">
            請貼 base URL（例：https://gateway.example.com/v1），不要包含 /chat/completions。
          </small>
        </label>
        <label>
          Models endpoint override (optional)
          <input
            value={provider.modelsEndpointOverride}
            placeholder="留空時由 API base URL 推導 /models"
            onChange={(event) =>
              updateProviderField("modelsEndpointOverride", event.target.value)
            }
          />
        </label>
        <label>
          API key env var
          <input
            value={provider.apiKeyEnvVar}
            placeholder="OPENAI_COMPAT_API_KEY"
            onChange={(event) =>
              updateProviderField(
                "apiKeyEnvVar",
                event.target.value.toUpperCase()
              )
            }
          />
        </label>
        <label>
          Temperature
          <input
            max={2}
            min={0}
            step={0.1}
            type="number"
            value={provider.temperature}
            onChange={(event) =>
              updateProviderField("temperature", Number(event.target.value))
            }
          />
        </label>
        <label>
          Max tokens
          <input
            max={16000}
            min={64}
            step={64}
            type="number"
            value={provider.maxTokens}
            onChange={(event) =>
              updateProviderField("maxTokens", Number(event.target.value))
            }
          />
        </label>
      </div>

      <div className="provider-prompt-grid">
        <label>
          System prompt
          <textarea
            rows={4}
            value={provider.systemPrompt}
            onChange={(event) =>
              updateProviderField("systemPrompt", event.target.value)
            }
          />
        </label>
        <label>
          User prompt template
          <textarea
            rows={4}
            value={provider.userPromptTemplate}
            onChange={(event) =>
              updateProviderField("userPromptTemplate", event.target.value)
            }
          />
          <span className="field-hint">
            Provider prompt 變數：{"{{categoryTitle}}"}、
            {"{{categoryInstruction}}"}、{"{{question}}"}。
            這些只會替換到送給模型的 prompt，不會修改受測者看到的問卷文案；
            受測者文案請在「受測者問卷文案」面板編輯。
          </span>
        </label>
      </div>

      <div className="provider-mapping-panel">
        <div className="section-heading compact-heading">
          <div>
            <p className="panel-kicker">Candidates</p>
            <h3>A/B/C 內部模型對應</h3>
          </div>
          <Button
            className="secondary-button"
            disabled={isDiscovering}
            type="button"
            onClick={discoverModels}
          >
            <Search aria-hidden="true" size={16} />
            {isDiscovering ? "探索中..." : "探索模型"}
          </Button>
        </div>
        <div className="provider-mapping-grid">
          {modelIds.map((modelId) => (
            <label key={modelId}>
              {modelId}
              {modelOptions.length ? (
                <select
                  value={provider.modelMapping[modelId] ?? ""}
                  onChange={(event) =>
                    updateModelMapping(modelId, event.target.value)
                  }
                >
                  <option value="">選擇 provider model</option>
                  {modelOptions.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={provider.modelMapping[modelId] ?? ""}
                  placeholder="provider model id"
                  onChange={(event) =>
                    updateModelMapping(modelId, event.target.value)
                  }
                />
              )}
            </label>
          ))}
        </div>
        {discovery ? (
          <p className="field-hint">
            已從 {discovery.endpoint} 取得 {discovery.modelIds.length}{" "}
            個模型，耗時 {discovery.latencyMs} ms。
          </p>
        ) : null}
      </div>

      <div className="provider-preview-panel">
        <label>
          Preview question
          <textarea
            rows={3}
            value={previewQuestion}
            onChange={(event) => setPreviewQuestion(event.target.value)}
          />
        </label>
        <div className="form-actions">
          <Button
            className="secondary-button"
            type="button"
            onClick={() => setProvider(cloneProvider(initialSettings.provider))}
          >
            <RefreshCw aria-hidden="true" size={16} />
            還原載入值
          </Button>
          <Button
            disabled={!canSave || isSaving}
            type="button"
            onClick={saveProviderSettings}
          >
            <Save aria-hidden="true" size={16} />
            {isSaving ? "儲存中..." : "儲存設定"}
          </Button>
          <Button
            disabled={!canSave || isPreviewing}
            type="button"
            onClick={previewProvider}
          >
            <Play aria-hidden="true" size={16} />
            {isPreviewing ? "測試中..." : "Preview"}
          </Button>
        </div>
      </div>

      {!canSave ? (
        <p className="field-error">
          請先替三個內部候選模型都填入 provider model id。
        </p>
      ) : null}

      {preview ? (
        <div className="provider-preview-results">
          {preview.candidates.map((candidate) => (
            <article key={candidate.label}>
              <p className="panel-kicker">
                {candidate.label} / {candidate.internalModelId}
              </p>
              <h4>{candidate.gatewayModelName}</h4>
              <p>{candidate.text}</p>
              <span>{candidate.latencyMs} ms</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
