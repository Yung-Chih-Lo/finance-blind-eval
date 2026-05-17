import type { StudyConfig } from "@/lib/evaluation/types"

interface CompletionPageProps {
  config: StudyConfig
}

export function CompletionPage({ config }: CompletionPageProps) {
  return (
    <main className="page-shell centered-page">
      <section className="entry-panel">
        <p className="eyebrow">{config.study.completion.eyebrow}</p>
        <h1>{config.study.completion.title}</h1>
        <p className="lede">{config.study.completion.description}</p>
        <div className="study-notes">
          {config.study.completion.notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
        <p className="completion-fallback-hint" role="note">
          若你並非剛剛完成問卷的人，可能是此瀏覽器先前已參與過。
          請改用無痕模式，或聯絡研究人員協助你開始。
        </p>
      </section>
    </main>
  )
}
