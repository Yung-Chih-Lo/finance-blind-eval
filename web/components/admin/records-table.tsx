"use client"

import { useCallback, useRef, useState } from "react"

import type { EvaluationRecord, StudyConfig } from "@/lib/evaluation/types"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { RecordDrawer } from "./record-drawer"

interface RecordsTableProps {
  records: EvaluationRecord[]
  config: StudyConfig
}

export function RecordsTable({ records, config }: RecordsTableProps) {
  const [selected, setSelected] = useState<EvaluationRecord | null>(null)
  const triggerRef = useRef<HTMLTableRowElement | null>(null)

  const handleClose = useCallback(() => {
    setSelected(null)
    triggerRef.current?.focus()
  }, [])

  const open = (record: EvaluationRecord, row: HTMLTableRowElement) => {
    triggerRef.current = row
    setSelected(record)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Token</TableHead>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>題型</TableHead>
            <TableHead>Best</TableHead>
            <TableHead>Worst</TableHead>
            <TableHead className="text-right">Latency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-[var(--admin-muted)]">
                尚無題目紀錄。
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow
                key={record.id}
                tabIndex={0}
                role="button"
                aria-label={`Open record ${record.participantToken} question ${record.questionIndex}`}
                className="cursor-pointer transition-colors hover:bg-[var(--admin-accent-soft)]/40 focus:outline-none focus:bg-[var(--admin-accent-soft)]/60 focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]"
                onClick={(event) => open(record, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    open(record, event.currentTarget)
                  }
                }}
              >
                <TableCell className="font-mono text-xs">{record.participantToken}</TableCell>
                <TableCell className="text-right tabular-nums">{record.questionIndex}</TableCell>
                <TableCell>{record.promptCategory}</TableCell>
                <TableCell>
                  {record.selectedBest}
                  <span className="ml-1 text-xs text-[var(--admin-muted)]">
                    {record.hiddenModelMapping[record.selectedBest]}
                  </span>
                </TableCell>
                <TableCell>
                  {record.selectedWorst}
                  <span className="ml-1 text-xs text-[var(--admin-muted)]">
                    {record.hiddenModelMapping[record.selectedWorst]}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{record.responseLatencyMs} ms</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <RecordDrawer record={selected} config={config} onClose={handleClose} />
    </>
  )
}
