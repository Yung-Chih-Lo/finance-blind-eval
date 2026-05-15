import type { PromptCategory, StudyConfig } from "@/lib/evaluation/types"
import {
  arrayToMultiline,
  cloneStudyConfig,
  multilineToArray,
} from "@/lib/evaluation/study-copy-form"

declare const config: StudyConfig

const cloned: StudyConfig = cloneStudyConfig(config)

cloned.study.eyebrow satisfies string
cloned.study.title satisfies string
cloned.study.rootTitle satisfies string
cloned.study.rootDescription satisfies string
cloned.study.intro.greeting satisfies string
cloned.study.intro.paragraphs satisfies string[]
cloned.study.intro.tasks satisfies string[]
cloned.study.signature.closing satisfies string
cloned.study.signature.studentName satisfies string
cloned.study.signature.affiliation satisfies string
cloned.study.signature.advisor satisfies string
cloned.study.signature.thesisTitle satisfies string
cloned.study.completion.eyebrow satisfies string
cloned.study.completion.title satisfies string
cloned.study.completion.description satisfies string
cloned.study.completion.notes satisfies string[]
cloned.promptCategories satisfies PromptCategory[]

const paragraphsText: string = arrayToMultiline(cloned.study.intro.paragraphs)
const restoredParagraphs: string[] = multilineToArray(paragraphsText)
restoredParagraphs.length satisfies number

// Blank rows and whitespace-only rows should be dropped.
const trimmed: string[] = multilineToArray("first\n\n  \n  second  \n")
const firstEntry: string | undefined = trimmed[0]
firstEntry satisfies string | undefined
