import { FileText, UserRound, Wallet } from "lucide-react"
import Link from "next/link"

import { Nav } from "@/components/nav"

// Kuya Hermit answers and AI document reading run as Server Actions on these
// pages and can take 20–60 s; give them room instead of the platform default.
export const maxDuration = 120

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-svh max-w-xl px-4 pt-4 pb-24 print:p-0">
      <header className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          HERMIT
        </Link>
        <nav className="flex items-center gap-3 text-sm text-muted-foreground sm:gap-4">
          <Link href="/forms" className="flex items-center gap-1.5" aria-label="Forms">
            <FileText className="size-5" aria-hidden /> <span className="hidden min-[400px]:inline">Forms</span>
          </Link>
          <Link href="/pay" className="flex items-center gap-1.5" aria-label="Bayad">
            <Wallet className="size-5" aria-hidden /> <span className="hidden min-[400px]:inline">Bayad</span>
          </Link>
          <Link href="/profile" className="flex items-center gap-1.5" aria-label="Profile">
            <UserRound className="size-5" aria-hidden /> <span className="hidden min-[400px]:inline">Profile</span>
          </Link>
        </nav>
      </header>
      {children}
      <Nav />
    </div>
  )
}
