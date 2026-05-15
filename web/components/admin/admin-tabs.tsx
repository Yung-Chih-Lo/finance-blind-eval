"use client"

import type { ReactNode } from "react"
import { useCallback, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export interface AdminTabSpec {
  id: string
  label: string
  content: ReactNode
}

interface AdminTabsProps {
  tabs: AdminTabSpec[]
  defaultTab: string
  brand: ReactNode
  kpi: ReactNode
  sidebarFooter?: ReactNode
  mainHeaderRight?: ReactNode
}

export function AdminTabs({
  tabs,
  defaultTab,
  brand,
  kpi,
  sidebarFooter,
  mainHeaderRight,
}: AdminTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)

  const validTabIds = new Set(tabs.map((tab) => tab.id))
  const requestedTab = searchParams.get("tab") ?? defaultTab
  const current = validTabIds.has(requestedTab) ? requestedTab : tabs[0]?.id ?? defaultTab
  const activeTab = tabs.find((tab) => tab.id === current) ?? tabs[0]

  const handleChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === tabs[0]?.id) {
        params.delete("tab")
      } else {
        params.set("tab", next)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams, tabs],
  )

  return (
    <Tabs
      value={current}
      onValueChange={handleChange}
      orientation="vertical"
      className="flex h-screen items-stretch gap-0 overflow-hidden"
    >
      <aside
        aria-hidden={collapsed}
        className={`flex shrink-0 flex-col overflow-hidden border-r border-[var(--admin-border)] bg-white transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-0 border-r-0" : "w-60"
        }`}
      >
        <div className="flex h-full w-60 shrink-0 flex-col">
          <div className="flex h-16 shrink-0 items-center border-b border-[var(--admin-border)] px-5">{brand}</div>

          <div className="flex-1 overflow-y-auto">
            <TabsList className="admin-tabs-list h-auto w-full flex-col items-stretch gap-0.5 bg-transparent p-3">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  tabIndex={collapsed ? -1 : 0}
                  className="admin-tabs-trigger w-full justify-start rounded-md px-3 py-2 text-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="border-t border-[var(--admin-border)] px-4 py-4">{kpi}</div>
          </div>

          {sidebarFooter ? (
            <div className="border-t border-[var(--admin-border)] px-4 py-3">{sidebarFooter}</div>
          ) : null}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-bg)] px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="rounded-md p-1.5 text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-accent-soft)] hover:text-[var(--admin-accent)]"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--admin-fg)]">
              {activeTab?.label ?? ""}
            </h2>
          </div>
          {mainHeaderRight ? (
            <div className="text-xs text-[var(--admin-muted)]">{mainHeaderRight}</div>
          ) : null}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 space-y-6">
              {tab.content}
            </TabsContent>
          ))}
        </div>
      </section>
    </Tabs>
  )
}
