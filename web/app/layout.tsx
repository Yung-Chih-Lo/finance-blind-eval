import type { Metadata } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastNotificationsProvider } from "@/components/ui/toast-provider"

export const metadata: Metadata = {
  title: "金融腦回答比較研究",
  description: "比較金融領域語言模型回答的研究問卷。",
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
