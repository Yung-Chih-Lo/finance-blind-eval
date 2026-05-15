import type { PromptCategory, StudyConfig } from "./types"

// Deep-clones the full StudyConfig (including non-editable fields like limits,
// modelIds, facets, flags) because `PUT /api/admin/settings` replaces the
// entire config — the non-editable subtree must round-trip unchanged.
export function cloneStudyConfig(config: StudyConfig): StudyConfig {
  return {
    ...config,
    study: {
      ...config.study,
      intro: {
        ...config.study.intro,
        paragraphs: [...config.study.intro.paragraphs],
        tasks: [...config.study.intro.tasks],
      },
      signature: { ...config.study.signature },
      completion: {
        ...config.study.completion,
        notes: [...config.study.completion.notes],
      },
    },
    limits: {
      ...config.limits,
      rateLimit: { ...config.limits.rateLimit },
    },
    answerLabels: [...config.answerLabels],
    modelIds: [...config.modelIds],
    promptCategories: config.promptCategories.map((category) => clonePromptCategory(category)),
    evaluationFacets: config.evaluationFacets.map((facet) => ({ ...facet })),
    worstAnswerFlags: config.worstAnswerFlags.map((flag) => ({ ...flag })),
  }
}

export function arrayToMultiline(items: string[]): string {
  return items.join("\n")
}

export function multilineToArray(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function clonePromptCategory(category: PromptCategory): PromptCategory {
  return {
    ...category,
    examples: [...category.examples],
  }
}
