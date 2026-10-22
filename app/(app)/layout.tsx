import Link from "next/link"

import { Nav } from "@/components/nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-svh max-w-xl px-4 pt-4 pb-24 print:p-0">
      <header className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          HERMIT
        </Link>
        <span className="text-xs text-muted-foreground">Your business, remembered.</span>
      </header>
      {children}
      <Nav />
    </div>
  )
}
