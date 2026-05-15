import type { Metadata } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastNotificationsProvider } from "@/components/ui/toast-provider"

export const metadata: Metadata = {
  title: "Finance Blind Evaluation",
  description:
    "Research survey-style blind evaluation for finance model answers.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className="font-sans antialiased"
    >
      <body>
        <ThemeProvider>
          <ToastNotificationsProvider>{children}</ToastNotificationsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
