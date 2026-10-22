"use client"

import { CalendarDays, LayoutList, MapPin, MessageCircle, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const TABS = [
  { href: "/dashboard", label: "Checklist", icon: LayoutList },
  { href: "/calendar", label: "Kalendaryo", icon: CalendarDays },
  { href: "/assistant", label: "Kuya Hermit", icon: MessageCircle },
  { href: "/offices", label: "Opisina", icon: MapPin },
  { href: "/profile", label: "Profile", icon: UserRound },
]

export function Nav() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur print:hidden">
      <ul className="mx-auto flex max-w-xl justify-around">
        {TABS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
              className={cn(
                "flex min-w-16 flex-col items-center gap-1 px-2 py-2.5 text-xs text-muted-foreground",
                path.startsWith(href) && "font-medium text-primary"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
