import type { Metadata } from "next"
import { Geist } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AccountScope } from "@/components/account-scope"
import { ownerId } from "@/lib/session"
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
})

export const metadata: Metadata = {
  title: "Hermit — Business compliance, one clear step at a time",
  description:
    "Find guidance for your City of Manila business, understand your next step, and track your compliance roadmap with Hermit.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentOwner = await ownerId()
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} font-sans antialiased`}
    >
      <body>
        <ThemeProvider defaultTheme="light" enableSystem={false}>
          <AccountScope ownerId={currentOwner}>{children}</AccountScope>
        </ThemeProvider>
      </body>
    </html>
  )
}
