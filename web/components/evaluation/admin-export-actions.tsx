"use client"

import { FileJson, Table } from "lucide-react"

export function AdminExportActions() {
  return (
    <div className="admin-actions">
      <a className="admin-link" href="/api/admin/export?format=json">
        <FileJson aria-hidden="true" size={16} />
        匯出 JSON
      </a>
      <a className="admin-link" href="/api/admin/export?format=csv">
        <Table aria-hidden="true" size={16} />
        匯出 CSV
      </a>
    </div>
  )
}
