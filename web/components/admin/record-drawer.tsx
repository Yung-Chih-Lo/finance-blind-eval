"use client"

import type { EvaluationRecord, StudyConfig } from "@/lib/evaluation/types"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AGE_RANGE_OPTIONS,
  AI_USAGE_FREQUENCY_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  MAIN_DOMAIN_OPTIONS,
  formatProfileChoice,
} from "@/lib/evaluation/profile"

interface RecordDrawerProps {
  record: EvaluationRecord | null
  config: StudyConfig
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)]">{title}</h4>
      <div className="text-sm text-[var(--admin-fg)]">{children}</div>
    </section>
  )
}

export function RecordDrawer({ record, config, onClose }: RecordDrawerProps) {
  return (
    <Sheet
      open={record != null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="right" className="admin-tokens w-full sm:max-w-xl p-6 overflow-y-auto bg-[var(--admin-surface)] text-[var(--admin-fg)]">
        {record ? (
          <>
            <SheetHeader className="p-0">
              <SheetTitle className="text-base">
                {record.participantToken} <span className="text-[var(--admin-muted)]">#{record.questionIndex}</span>
              </SheetTitle>
              <SheetDescription className="text-xs">
                {record.promptCategory} · {record.responseLatencyMs} ms
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <Section title="Participant profile">
                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--admin-muted)]">年齡</dt>
                    <dd>{formatProfileChoice(AGE_RANGE_OPTIONS, record.participantProfile.ageRange)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--admin-muted)]">學歷</dt>
                    <dd>{formatProfileChoice(EDUCATION_LEVEL_OPTIONS, record.participantProfile.educationLevel)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--admin-muted)]">目前主要領域</dt>
                    <dd>{formatProfileChoice(MAIN_DOMAIN_OPTIONS, record.participantProfile.mainDomain)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--admin-muted)]">AI 使用頻率</dt>
                    <dd>{formatProfileChoice(AI_USAGE_FREQUENCY_OPTIONS, record.participantProfile.aiUsageFrequency)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[var(--admin-muted)]">曾用 AI 處理金融?</dt>
                    <dd>
                      {record.participantProfile.hasUsedAiForFinance === true
                        ? "Y"
                        : record.participantProfile.hasUsedAiForFinance === false
                          ? "N"
                          : "—"}
                    </dd>
                  </div>
                </dl>
              </Section>

              <Section title="User question">
                <p className="whitespace-pre-wrap leading-relaxed">{record.userQuestion}</p>
              </Section>

              <Section title="Selected best / worst">
                <p>
                  Best: <strong>{record.selectedBest}</strong> ({record.hiddenModelMapping[record.selectedBest]})
                  {" · "}
                  Worst: <strong>{record.selectedWorst}</strong> ({record.hiddenModelMapping[record.selectedWorst]})
                </p>
              </Section>

              <Section title="Facet selections">
                {config.evaluationFacets.length === 0 ? (
                  <p className="text-[var(--admin-muted)]">尚無 facet。</p>
                ) : (
                  <ul className="space-y-1">
                    {config.evaluationFacets.map((facet) => {
                      const label = record.facetSelections?.[facet.id]
                      const resolved = label ? record.hiddenModelMapping[label] : null
                      return (
                        <li key={facet.id}>
                          <span className="text-[var(--admin-muted)]">{facet.label}: </span>
                          {label ? (
                            <span>
                              {label} <span className="text-[var(--admin-muted)]">/ {resolved}</span>
                            </span>
                          ) : (
                            <span className="text-[var(--admin-muted)]">—</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              <Section title="Worst-answer flags">
                {(record.worstAnswerFlags ?? []).length === 0 ? (
                  <span className="text-[var(--admin-muted)]">—</span>
                ) : (
                  <ul className="list-disc pl-5">
                    {(record.worstAnswerFlags ?? []).map((flagId) => (
                      <li key={flagId}>{flagId}</li>
                    ))}
                  </ul>
                )}
                {record.worstOtherText ? (
                  <p className="mt-2">
                    <span className="text-[var(--admin-muted)]">Other note: </span>
                    <span className="whitespace-pre-wrap">{record.worstOtherText}</span>
                  </p>
                ) : null}
              </Section>

              <Section title="Hidden mapping">
                <p className="font-mono text-xs">
                  A={record.hiddenModelMapping.A}, B={record.hiddenModelMapping.B}, C={record.hiddenModelMapping.C}
                </p>
              </Section>

              {(record.bestReason || record.worstReason) ? (
                <Section title="Reasons">
                  {record.bestReason ? (
                    <p>
                      <span className="text-[var(--admin-muted)]">Best: </span>
                      {record.bestReason}
                    </p>
                  ) : null}
                  {record.worstReason ? (
                    <p>
                      <span className="text-[var(--admin-muted)]">Worst: </span>
                      {record.worstReason}
                    </p>
                  ) : null}
                </Section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
