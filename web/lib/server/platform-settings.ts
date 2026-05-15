import "server-only"

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { DEFAULT_STUDY_CONFIG } from "@/lib/evaluation/config"
import type {
  ActivePlatformSettings,
  AnswerLabel,
  EvaluationFacetId,
  ModelId,
  PlatformSettingsEnvelope,
  PlatformSettingsValidationResult,
  ProviderSettings,
  StudyConfig,
} from "@/lib/evaluation/types"
import {
  assertValidProviderSettings,
  createProviderSettingsStatus,
  getDefaultProviderSettings,
  normalizeProviderSettings,
  ProviderSettingsError,
} from "@/lib/server/provider-settings"

export const DEFAULT_SETTINGS_VERSION = 2

const ANSWER_LABELS: AnswerLabel[] = ["A", "B", "C"]
const MODEL_IDS: ModelId[] = ["H1-best", "H2-best", "TAIDE-baseline"]
const EVALUATION_FACET_IDS: EvaluationFacetId[] = ["correctness", "reasoning", "completeness", "readability"]

export class PlatformSettingsError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
    readonly status = 500,
  ) {
    super(message)
    this.name = "PlatformSettingsError"
  }
}

function cloneStudyConfig(config: StudyConfig): StudyConfig {
  return structuredClone(config)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isPositiveInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}

export function getPlatformSettingsPath() {
  const fileName = basename(process.env.PLATFORM_SETTINGS_FILE || "platform-settings.json")
  return join(process.cwd(), ".data", fileName)
}

export function getSettingsSnapshotHash(config: StudyConfig, provider: ProviderSettings = getDefaultProviderSettings()) {
  return createHash("sha256").update(stableStringify({ config, provider })).digest("hex")
}

function validateStringPath(value: unknown, path: string, issues: string[]) {
  if (!isNonEmptyString(value)) {
    issues.push(`${path} must be a non-empty string.`)
  }
}

function validateStringArrayPath(value: unknown, path: string, issues: string[], options: { minLength?: number } = {}) {
  if (!isStringArray(value)) {
    issues.push(`${path} must be a string array.`)
    return
  }

  const minLength = options.minLength ?? 1
  if (value.length < minLength) {
    issues.push(`${path} must contain at least ${minLength} item(s).`)
  }
  value.forEach((item, index) => {
    if (!item.trim()) {
      issues.push(`${path}[${index}] must be a non-empty string.`)
    }
  })
}

function validateChoiceSet<T extends string>(value: unknown, expected: T[], path: string, issues: string[]) {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array.`)
    return
  }

  const allowed = new Set(expected)
  const actual = value.filter((item): item is string => typeof item === "string")
  if (actual.length !== value.length) {
    issues.push(`${path} must contain only strings.`)
    return
  }
  if (actual.length !== expected.length || new Set(actual).size !== actual.length) {
    issues.push(`${path} must contain exactly ${expected.join(", ")}.`)
    return
  }
  actual.forEach((item) => {
    if (!allowed.has(item as T)) {
      issues.push(`${path} contains unsupported value ${item}.`)
    }
  })
}

export function validateStudyConfig(value: unknown): PlatformSettingsValidationResult {
  const issues: string[] = []
  if (!isObject(value)) {
    return { ok: false, issues: ["config must be an object."] }
  }

  const study = value.study
  if (!isObject(study)) {
    issues.push("study must be an object.")
  } else {
    validateStringPath(study.eyebrow, "study.eyebrow", issues)
    validateStringPath(study.title, "study.title", issues)
    validateStringPath(study.rootTitle, "study.rootTitle", issues)
    validateStringPath(study.rootDescription, "study.rootDescription", issues)

    if (!isObject(study.intro)) {
      issues.push("study.intro must be an object.")
    } else {
      validateStringPath(study.intro.greeting, "study.intro.greeting", issues)
      validateStringArrayPath(study.intro.paragraphs, "study.intro.paragraphs", issues, { minLength: 1 })
      validateStringArrayPath(study.intro.tasks, "study.intro.tasks", issues, { minLength: 1 })
    }

    if (!isObject(study.signature)) {
      issues.push("study.signature must be an object.")
    } else {
      validateStringPath(study.signature.closing, "study.signature.closing", issues)
      validateStringPath(study.signature.studentName, "study.signature.studentName", issues)
      validateStringPath(study.signature.affiliation, "study.signature.affiliation", issues)
      validateStringPath(study.signature.advisor, "study.signature.advisor", issues)
      validateStringPath(study.signature.thesisTitle, "study.signature.thesisTitle", issues)
    }

    if (!isObject(study.completion)) {
      issues.push("study.completion must be an object.")
    } else {
      validateStringPath(study.completion.eyebrow, "study.completion.eyebrow", issues)
      validateStringPath(study.completion.title, "study.completion.title", issues)
      validateStringPath(study.completion.description, "study.completion.description", issues)
      validateStringArrayPath(study.completion.notes, "study.completion.notes", issues, { minLength: 1 })
    }
  }

  const limits = value.limits
  if (!isObject(limits)) {
    issues.push("limits must be an object.")
  } else {
    if (!isPositiveInteger(limits.minQuestionLength)) {
      issues.push("limits.minQuestionLength must be a positive integer.")
    }
    if (!isPositiveInteger(limits.maxQuestionLength)) {
      issues.push("limits.maxQuestionLength must be a positive integer.")
    }
    if (
      isPositiveInteger(limits.minQuestionLength) &&
      isPositiveInteger(limits.maxQuestionLength) &&
      Number(limits.maxQuestionLength) < Number(limits.minQuestionLength)
    ) {
      issues.push("limits.maxQuestionLength must be greater than or equal to limits.minQuestionLength.")
    }
    if (!isPositiveInteger(limits.maxQuestionsPerParticipant)) {
      issues.push("limits.maxQuestionsPerParticipant must be a positive integer.")
    }
    if (!isObject(limits.rateLimit)) {
      issues.push("limits.rateLimit must be an object.")
    } else {
      if (!isPositiveInteger(limits.rateLimit.inviteRedeemPerIpPerHour)) {
        issues.push("limits.rateLimit.inviteRedeemPerIpPerHour must be a positive integer.")
      }
      if (!isPositiveInteger(limits.rateLimit.answerRequestsPerIpPerMinute)) {
        issues.push("limits.rateLimit.answerRequestsPerIpPerMinute must be a positive integer.")
      }
      if (!isPositiveInteger(limits.rateLimit.answerRequestsPerSessionPerMinute)) {
        issues.push("limits.rateLimit.answerRequestsPerSessionPerMinute must be a positive integer.")
      }
    }
  }

  validateChoiceSet(value.answerLabels, ANSWER_LABELS, "answerLabels", issues)
  validateChoiceSet(value.modelIds, MODEL_IDS, "modelIds", issues)

  if (!Array.isArray(value.promptCategories) || value.promptCategories.length < 1) {
    issues.push("promptCategories must contain at least one category.")
  } else {
    value.promptCategories.forEach((category, index) => {
      if (!isObject(category)) {
        issues.push(`promptCategories[${index}] must be an object.`)
        return
      }
      validateStringPath(category.id, `promptCategories[${index}].id`, issues)
      validateStringPath(category.title, `promptCategories[${index}].title`, issues)
      validateStringPath(category.instruction, `promptCategories[${index}].instruction`, issues)
      validateStringArrayPath(category.examples, `promptCategories[${index}].examples`, issues, { minLength: 5 })
    })
  }

  if (!Array.isArray(value.evaluationFacets)) {
    issues.push("evaluationFacets must be an array.")
  } else {
    const facetIds = value.evaluationFacets.map((facet) => (isObject(facet) ? facet.id : undefined))
    validateChoiceSet(facetIds, EVALUATION_FACET_IDS, "evaluationFacets[].id", issues)
    value.evaluationFacets.forEach((facet, index) => {
      if (!isObject(facet)) {
        issues.push(`evaluationFacets[${index}] must be an object.`)
        return
      }
      validateStringPath(facet.label, `evaluationFacets[${index}].label`, issues)
      validateStringPath(facet.helper, `evaluationFacets[${index}].helper`, issues)
    })
  }

  if (!Array.isArray(value.worstAnswerFlags) || value.worstAnswerFlags.length < 1) {
    issues.push("worstAnswerFlags must contain at least one flag.")
  } else {
    const ids = new Set<string>()
    value.worstAnswerFlags.forEach((flag, index) => {
      if (!isObject(flag)) {
        issues.push(`worstAnswerFlags[${index}] must be an object.`)
        return
      }
      validateStringPath(flag.id, `worstAnswerFlags[${index}].id`, issues)
      validateStringPath(flag.label, `worstAnswerFlags[${index}].label`, issues)
      if (isNonEmptyString(flag.id)) {
        if (ids.has(flag.id)) {
          issues.push(`worstAnswerFlags[${index}].id must be unique.`)
        }
        ids.add(flag.id)
      }
    })
  }

  return { ok: issues.length === 0, issues }
}

function assertValidStudyConfig(value: unknown): StudyConfig {
  const validation = validateStudyConfig(value)
  if (!validation.ok) {
    throw new PlatformSettingsError("Platform settings validation failed.", validation.issues, 400)
  }
  return cloneStudyConfig(value as StudyConfig)
}

function buildEnvelope(
  config: StudyConfig,
  provider: ProviderSettings,
  params: { settingsVersion: number; updatedAt: string; updatedBy: string },
) {
  const normalizedConfig = assertValidStudyConfig(config)
  const normalizedProvider = normalizeProviderSettings(provider)
  return {
    settingsVersion: params.settingsVersion,
    updatedAt: params.updatedAt,
    updatedBy: params.updatedBy,
    settingsSnapshotHash: getSettingsSnapshotHash(normalizedConfig, normalizedProvider),
    config: normalizedConfig,
    provider: normalizedProvider,
  } satisfies PlatformSettingsEnvelope
}

function defaultEnvelope() {
  return buildEnvelope(DEFAULT_STUDY_CONFIG, getDefaultProviderSettings(), {
    settingsVersion: DEFAULT_SETTINGS_VERSION,
    updatedAt: "1970-01-01T00:00:00.000Z",
    updatedBy: "default",
  })
}

function normalizeEnvelope(value: unknown): PlatformSettingsEnvelope {
  if (!isObject(value)) {
    throw new PlatformSettingsError("Runtime platform settings must be a JSON object.", [], 500)
  }

  const maybeEnvelope = value.config ? value : { config: value }
  if (!isObject(maybeEnvelope)) {
    throw new PlatformSettingsError("Runtime platform settings envelope is invalid.", [], 500)
  }

  const settingsVersion = isPositiveInteger(maybeEnvelope.settingsVersion)
    ? Number(maybeEnvelope.settingsVersion)
    : DEFAULT_SETTINGS_VERSION
  const updatedAt = isNonEmptyString(maybeEnvelope.updatedAt) ? maybeEnvelope.updatedAt : new Date().toISOString()
  const updatedBy = isNonEmptyString(maybeEnvelope.updatedBy) ? maybeEnvelope.updatedBy : "admin"
  try {
    const provider = normalizeProviderSettings(maybeEnvelope.provider, getDefaultProviderSettings())
    return buildEnvelope(assertValidStudyConfig(maybeEnvelope.config), provider, { settingsVersion, updatedAt, updatedBy })
  } catch (error) {
    if (error instanceof PlatformSettingsError) {
      throw new PlatformSettingsError("Runtime platform settings validation failed.", error.issues, 500)
    }
    if (error instanceof ProviderSettingsError) {
      throw new PlatformSettingsError("Runtime provider settings validation failed.", error.issues, 500)
    }
    throw error
  }
}

function toActiveSettings(
  envelope: PlatformSettingsEnvelope,
  source: ActivePlatformSettings["source"],
): ActivePlatformSettings {
  const hash = envelope.settingsSnapshotHash || getSettingsSnapshotHash(envelope.config, envelope.provider)
  return {
    source,
    path: getPlatformSettingsPath(),
    envelope: { ...envelope, settingsSnapshotHash: hash },
    config: envelope.config,
    provider: envelope.provider,
    providerStatus: createProviderSettingsStatus(envelope.provider),
    settingsVersion: envelope.settingsVersion,
    settingsSnapshotHash: hash,
    updatedAt: envelope.updatedAt,
    updatedBy: envelope.updatedBy,
  }
}

export async function getActivePlatformSettings(): Promise<ActivePlatformSettings> {
  const path = getPlatformSettingsPath()
  try {
    const raw = await readFile(path, "utf8")
    return toActiveSettings(normalizeEnvelope(JSON.parse(raw)), "runtime")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return toActiveSettings(defaultEnvelope(), "default")
    }
    if (error instanceof PlatformSettingsError) {
      throw error
    }
    throw new PlatformSettingsError(
      "Runtime platform settings could not be loaded.",
      [error instanceof Error ? error.message : String(error)],
      500,
    )
  }
}

export async function savePlatformSettings(payload: unknown, updatedBy = "admin"): Promise<ActivePlatformSettings> {
  const active = await getActivePlatformSettings()
  const configPayload = getConfigFromSettingsPayload(payload) ?? active.config
  const providerPayload = getProviderFromSettingsPayload(payload)
  const provider =
    providerPayload === undefined
      ? active.provider
      : assertValidProviderSettings(providerPayload, { requireComplete: true })
  const envelope = buildEnvelope(assertValidStudyConfig(configPayload), provider, {
    settingsVersion: active.settingsVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
  })
  const path = getPlatformSettingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(envelope, null, 2)}\n`, "utf8")
  return toActiveSettings(envelope, "runtime")
}

export async function resetPlatformSettings(updatedBy = "admin"): Promise<ActivePlatformSettings> {
  const active = await getActivePlatformSettings().catch(() => toActiveSettings(defaultEnvelope(), "default"))
  const envelope = buildEnvelope(DEFAULT_STUDY_CONFIG, getDefaultProviderSettings(), {
    settingsVersion: active.settingsVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
  })
  const path = getPlatformSettingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(envelope, null, 2)}\n`, "utf8")
  return toActiveSettings(envelope, "runtime")
}

export async function exportPlatformSettings(): Promise<ActivePlatformSettings> {
  return getActivePlatformSettings()
}

export function getConfigFromSettingsPayload(payload: unknown): unknown {
  if (!isObject(payload)) {
    return payload
  }

  if ("config" in payload) {
    return payload.config
  }
  if ("provider" in payload) {
    return undefined
  }
  return payload
}

export function getProviderFromSettingsPayload(payload: unknown): unknown | undefined {
  if (!isObject(payload) || !("provider" in payload)) {
    return undefined
  }

  return payload.provider
}
