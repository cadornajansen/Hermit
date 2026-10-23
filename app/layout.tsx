import type { Metadata } from "next"
import { Geist } from "next/font/google"

import "./globals.css"
import { AccountScope } from "@/components/account-scope"
import { ThemeProvider } from "@/components/theme-provider"
import { ownerId } from "@/lib/session"

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
})

export const metadata: Metadata = {
  title: "Hermit — Business compliance, one clear step at a time",
  description: "Find the permits, registrations and filings your Philippine business needs, see what comes next, and let Kuya Hermit prepare the forms.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The device keeps one owner's data at a time: an email account, an eGovPH
  // identity or an anonymous owner.
  const currentOwner = await ownerId()
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} font-sans antialiased`}>
      <body>
        <ThemeProvider defaultTheme="light" enableSystem={false}>
          <AccountScope ownerId={currentOwner}>{children}</AccountScope>
        </ThemeProvider>
      </body>
    </html>
  )
}
