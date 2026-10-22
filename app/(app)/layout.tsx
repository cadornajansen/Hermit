import { UserRound } from "lucide-react"
import Link from "next/link"

import { Nav } from "@/components/nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-svh max-w-xl px-4 pt-4 pb-24 print:p-0">
      <header className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          HERMIT
        </Link>
        <Link href="/profile" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <UserRound className="size-5" aria-hidden /> Profile
        </Link>
      </header>
      {children}
      <Nav />
    </div>
  )
}
