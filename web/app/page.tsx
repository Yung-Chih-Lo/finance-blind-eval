import Link from "next/link"

import { getActivePlatformSettings } from "@/lib/server/platform-settings"

export const dynamic = "force-dynamic"

export default async function Page() {
  const settings = await getActivePlatformSettings()
  const { study } = settings.config

  return (
    <main className="page-shell centered-page">
      <section className="entry-panel">
        <p className="eyebrow">Finance Blind Evaluation</p>
        <h1>{study.rootTitle}</h1>
        <p className="lede">{study.rootDescription}</p>
        <div className="admin-actions">
          <Link className="admin-link" href="/eval">
            開啟受測者入口
          </Link>
        </div>
      </section>
    </main>
  )
}
