"use client"

import { RefreshCw, Save } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast-provider"
import {
  arrayToMultiline,
  cloneStudyConfig,
  multilineToArray,
} from "@/lib/evaluation/study-copy-form"
import type {
  ActivePlatformSettings,
  StudyConfig,
} from "@/lib/evaluation/types"

interface ApiError {
  error?: string
  issues?: string[]
}

interface AdminStudyCopySettingsProps {
  initialSettings: ActivePlatformSettings
}

interface CategoryDraft {
  id: string
  title: string
  instruction: string
  examplesText: string
}

interface StudyCopyDraft {
  eyebrow: string
  title: string
  rootTitle: string
  rootDescription: string
  introGreeting: string
  introParagraphsText: string
  introTasksText: string
  signatureClosing: string
  signatureStudentName: string
  signatureAffiliation: string
  signatureAdvisor: string
  signatureThesisTitle: string
  completionEyebrow: string
  completionTitle: string
  completionDescription: string
  completionNotesText: string
  categories: CategoryDraft[]
}

function draftFromConfig(config: StudyConfig): StudyCopyDraft {
  const cloned = cloneStudyConfig(config)
  return {
    eyebrow: cloned.study.eyebrow,
    title: cloned.study.title,
    rootTitle: cloned.study.rootTitle,
    rootDescription: cloned.study.rootDescription,
    introGreeting: cloned.study.intro.greeting,
    introParagraphsText: arrayToMultiline(cloned.study.intro.paragraphs),
    introTasksText: arrayToMultiline(cloned.study.intro.tasks),
    signatureClosing: cloned.study.signature.closing,
    signatureStudentName: cloned.study.signature.studentName,
    signatureAffiliation: cloned.study.signature.affiliation,
    signatureAdvisor: cloned.study.signature.advisor,
    signatureThesisTitle: cloned.study.signature.thesisTitle,
    completionEyebrow: cloned.study.completion.eyebrow,
    completionTitle: cloned.study.completion.title,
    completionDescription: cloned.study.completion.description,
    completionNotesText: arrayToMultiline(cloned.study.completion.notes),
    categories: cloned.promptCategories.map((category) => ({
      id: category.id,
      title: category.title,
      instruction: category.instruction,
      examplesText: arrayToMultiline(category.examples),
    })),
  }
}

function configFromDraft(base: StudyConfig, draft: StudyCopyDraft): StudyConfig {
  const cloned = cloneStudyConfig(base)
  cloned.study.eyebrow = draft.eyebrow
  cloned.study.title = draft.title
  cloned.study.rootTitle = draft.rootTitle
  cloned.study.rootDescription = draft.rootDescription
  cloned.study.intro.greeting = draft.introGreeting
  cloned.study.intro.paragraphs = multilineToArray(draft.introParagraphsText)
  cloned.study.intro.tasks = multilineToArray(draft.introTasksText)
  cloned.study.signature.closing = draft.signatureClosing
  cloned.study.signature.studentName = draft.signatureStudentName
  cloned.study.signature.affiliation = draft.signatureAffiliation
  cloned.study.signature.advisor = draft.signatureAdvisor
  cloned.study.signature.thesisTitle = draft.signatureThesisTitle
  cloned.study.completion.eyebrow = draft.completionEyebrow
  cloned.study.completion.title = draft.completionTitle
  cloned.study.completion.description = draft.completionDescription
  cloned.study.completion.notes = multilineToArray(draft.completionNotesText)

  cloned.promptCategories = cloned.promptCategories.map((category, index) => {
    const categoryDraft = draft.categories[index]
    if (!categoryDraft) {
      return category
    }
    return {
      ...category,
      title: categoryDraft.title,
      instruction: categoryDraft.instruction,
      examples: multilineToArray(categoryDraft.examplesText),
    }
  })

  return cloned
}

function formatIssues(data: ApiError) {
  return [data.error, ...(data.issues ?? [])].filter(Boolean).join(" ")
}

export function AdminStudyCopySettings({
  initialSettings,
}: AdminStudyCopySettingsProps) {
  const toast = useToast()
  const [draft, setDraft] = useState<StudyCopyDraft>(() =>
    draftFromConfig(initialSettings.config)
  )
  const [isSaving, setIsSaving] = useState(false)

  const baseConfig = useMemo(
    () => initialSettings.config,
    [initialSettings.config]
  )

  function updateField<K extends keyof StudyCopyDraft>(
    field: K,
    value: StudyCopyDraft[K]
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function updateCategoryField(
    index: number,
    field: keyof Omit<CategoryDraft, "id">,
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.map((category, i) =>
        i === index ? { ...category, [field]: value } : category
      ),
    }))
  }

  function restoreLoadedValues() {
    setDraft(draftFromConfig(initialSettings.config))
  }

  async function saveStudyCopy() {
    setIsSaving(true)
    try {
      const config = configFromDraft(baseConfig, draft)
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      })
      const data = (await response.json()) as ActivePlatformSettings | ApiError
      if (!response.ok) {
        throw new Error(
          formatIssues(data as ApiError) || "Study copy save failed."
        )
      }
      const saved = data as ActivePlatformSettings
      setDraft(draftFromConfig(saved.config))
      toast.success(`Study copy saved. Version v${saved.settingsVersion}.`)
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Study copy save failed."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="table-section admin-study-copy-panel">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">Study copy</p>
          <h2>受測者問卷文案</h2>
        </div>
      </div>

      <div className="study-copy-group">
        <h3>研究識別</h3>
        <div className="study-copy-grid">
          <label>
            Study eyebrow
            <input
              value={draft.eyebrow}
              onChange={(event) => updateField("eyebrow", event.target.value)}
            />
          </label>
          <label>
            Study title
            <input
              value={draft.title}
              onChange={(event) => updateField("title", event.target.value)}
            />
          </label>
          <label>
            Root title
            <input
              value={draft.rootTitle}
              onChange={(event) =>
                updateField("rootTitle", event.target.value)
              }
            />
          </label>
          <label className="study-copy-grid-wide">
            Root description
            <textarea
              rows={2}
              value={draft.rootDescription}
              onChange={(event) =>
                updateField("rootDescription", event.target.value)
              }
            />
          </label>
        </div>
      </div>

      <div className="study-copy-group">
        <h3>受測者來信</h3>
        <div className="study-copy-grid">
          <label className="study-copy-grid-wide">
            Greeting
            <input
              value={draft.introGreeting}
              onChange={(event) =>
                updateField("introGreeting", event.target.value)
              }
            />
          </label>
          <label className="study-copy-grid-wide">
            Paragraphs
            <textarea
              rows={5}
              value={draft.introParagraphsText}
              onChange={(event) =>
                updateField("introParagraphsText", event.target.value)
              }
            />
            <span className="field-hint">每行一段。</span>
          </label>
          <label className="study-copy-grid-wide">
            Tasks
            <textarea
              rows={4}
              value={draft.introTasksText}
              onChange={(event) =>
                updateField("introTasksText", event.target.value)
              }
            />
            <span className="field-hint">每行一個任務。</span>
          </label>
        </div>
      </div>

      <div className="study-copy-group">
        <h3>署名與研究背景</h3>
        <div className="study-copy-grid">
          <label>
            Closing
            <input
              value={draft.signatureClosing}
              onChange={(event) =>
                updateField("signatureClosing", event.target.value)
              }
            />
          </label>
          <label>
            Student name
            <input
              value={draft.signatureStudentName}
              onChange={(event) =>
                updateField("signatureStudentName", event.target.value)
              }
            />
          </label>
          <label>
            Affiliation / school
            <input
              value={draft.signatureAffiliation}
              onChange={(event) =>
                updateField("signatureAffiliation", event.target.value)
              }
            />
          </label>
          <label>
            Advisor / professor
            <input
              value={draft.signatureAdvisor}
              onChange={(event) =>
                updateField("signatureAdvisor", event.target.value)
              }
            />
          </label>
          <label className="study-copy-grid-wide">
            Thesis title
            <input
              value={draft.signatureThesisTitle}
              onChange={(event) =>
                updateField("signatureThesisTitle", event.target.value)
              }
            />
          </label>
        </div>
        <p className="field-hint">
          這些欄位顯示在受測者頁面，不會被注入到模型 prompt。
        </p>
      </div>

      <div className="study-copy-group">
        <h3>完成頁文案</h3>
        <div className="study-copy-grid">
          <label>
            Completion eyebrow
            <input
              value={draft.completionEyebrow}
              onChange={(event) =>
                updateField("completionEyebrow", event.target.value)
              }
            />
          </label>
          <label>
            Completion title
            <input
              value={draft.completionTitle}
              onChange={(event) =>
                updateField("completionTitle", event.target.value)
              }
            />
          </label>
          <label className="study-copy-grid-wide">
            Completion description
            <textarea
              rows={2}
              value={draft.completionDescription}
              onChange={(event) =>
                updateField("completionDescription", event.target.value)
              }
            />
          </label>
          <label className="study-copy-grid-wide">
            Completion notes
            <textarea
              rows={4}
              value={draft.completionNotesText}
              onChange={(event) =>
                updateField("completionNotesText", event.target.value)
              }
            />
            <span className="field-hint">每行一條提醒。</span>
          </label>
        </div>
      </div>

      <div className="study-copy-group">
        <h3>題型分類與範例</h3>
        <p className="field-hint">
          每個題型需提供至少 5
          個非空範例。範例文字僅顯示給受測者參考，不會傳給模型。
        </p>
        <div className="study-copy-categories">
          {draft.categories.map((category, index) => (
            <article
              key={category.id}
              className="study-copy-category"
              aria-label={`Prompt category ${category.id}`}
            >
              <p className="panel-kicker">{category.id}</p>
              <label>
                Category title
                <input
                  value={category.title}
                  onChange={(event) =>
                    updateCategoryField(index, "title", event.target.value)
                  }
                />
              </label>
              <label>
                Instruction
                <textarea
                  rows={3}
                  value={category.instruction}
                  onChange={(event) =>
                    updateCategoryField(
                      index,
                      "instruction",
                      event.target.value
                    )
                  }
                />
              </label>
              <label>
                Examples
                <textarea
                  rows={6}
                  value={category.examplesText}
                  onChange={(event) =>
                    updateCategoryField(
                      index,
                      "examplesText",
                      event.target.value
                    )
                  }
                />
                <span className="field-hint">每行一個範例，至少 5 行。</span>
              </label>
            </article>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <Button
          className="secondary-button"
          disabled={isSaving}
          type="button"
          onClick={restoreLoadedValues}
        >
          <RefreshCw aria-hidden="true" size={16} />
          還原載入值
        </Button>
        <Button disabled={isSaving} type="button" onClick={saveStudyCopy}>
          <Save aria-hidden="true" size={16} />
          {isSaving ? "儲存中..." : "儲存文案"}
        </Button>
      </div>
    </section>
  )
}
