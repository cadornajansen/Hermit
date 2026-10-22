"use client"

import { CalendarDays, FileCheck2, LayoutList, MapPin, MessageCircle } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const TABS = [
  { href: "/dashboard", label: "Checklist", icon: LayoutList },
  { href: "/vault", label: "Dokumento", icon: FileCheck2 },
  { href: "/calendar", label: "Kalendaryo", icon: CalendarDays },
  { href: "/assistant", label: "Kuya Hermit", icon: MessageCircle },
  { href: "/offices", label: "Opisina", icon: MapPin },
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
                "flex min-w-14 flex-col items-center gap-1 px-1.5 py-2.5 text-[11px] text-muted-foreground",
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
