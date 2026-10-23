"use client"

import { CalendarDays, FileCheck2, LayoutDashboard, ListChecks, MapPin, MessageCircle, UserRound } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export const WORKSPACE_PAGES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/vault", label: "Documents", icon: FileCheck2 },
  { href: "/offices", label: "Office Locator", icon: MapPin },
] as const

export const ACCOUNT_PAGES = [
  { href: "/assistant", label: "Ask Hermit", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const

type NavProps = {
  collapsed?: boolean
  section?: "workspace" | "account"
  onNavigate?: () => void
}

export function Nav({ collapsed = false, section = "workspace", onNavigate }: NavProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const pages = section === "workspace" ? WORKSPACE_PAGES : ACCOUNT_PAGES
  return (
    <nav aria-label={section === "workspace" ? "Workspace" : "Account and help"}>
      <ul className="flex flex-col gap-1">
        {pages.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex h-11 min-w-11 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm whitespace-nowrap transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <motion.span
                  initial={false}
                  animate={{ opacity: collapsed ? 0 : 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.12, delay: collapsed || reduceMotion ? 0 : 0.08 }}
                  aria-hidden={collapsed}
                  className="shrink-0"
                >
                  {label}
                </motion.span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
