"use client"

import { ArrowUpRight, FileText, Search } from "lucide-react"
import Link from "next/link"
import { useId, useRef, useState } from "react"

import { ACCOUNT_PAGES, WORKSPACE_PAGES } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { buildChecklist } from "@/lib/engine"
import { useHermit } from "@/lib/store"
import { cn } from "@/lib/utils"

export function WorkspaceSearch({ compact = false }: { compact?: boolean }) {
  const { profile, items } = useHermit()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const search = query.trim().toLocaleLowerCase()
  const pages = [...WORKSPACE_PAGES, ...ACCOUNT_PAGES].filter((page) => page.label.toLocaleLowerCase().includes(search))
  const requirements = profile
    ? buildChecklist(profile, items).filter((item) => `${item.name} ${item.agency}`.toLocaleLowerCase().includes(search))
    : []

  function changeOpen(next: boolean): void {
    setOpen(next)
    if (!next) setQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={<Button variant={compact ? "ghost" : "secondary"} size={compact ? "icon" : "default"} className={cn("rounded-lg", !compact && "w-full justify-start")} />}
        aria-label="Search workspace"
        title={compact ? "Search workspace" : undefined}
      >
        <Search data-icon="inline-start" aria-hidden="true" />
        {!compact && <span>Search</span>}
      </DialogTrigger>
      <DialogContent className="max-h-[min(38rem,calc(100dvh-2rem))] grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden rounded-lg p-5 sm:max-w-lg [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:bg-transparent" initialFocus={inputRef}>
        <DialogHeader>
          <DialogTitle>Search workspace</DialogTitle>
          <DialogDescription>Find a page or a requirement in your roadmap.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel className="sr-only" htmlFor={inputId}>Search pages and requirements</FieldLabel>
            <Input id={inputId} ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or office…" className="rounded-xl" autoComplete="off" />
          </Field>
        </FieldGroup>
        <div className="min-h-0 overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          {pages.length > 0 && (
            <section aria-label="Pages" className="mb-4">
              <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">Pages</h3>
              <ul className="flex flex-col gap-1">
                {pages.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link href={href} onClick={() => changeOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm outline-none hover:bg-muted focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {label}
                      <ArrowUpRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {requirements.length > 0 && (
            <section aria-label="Requirements">
              <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">Requirements</h3>
              <ul className="flex flex-col gap-1">
                {requirements.map((item) => (
                  <li key={item.id}>
                    <Link href={`/roadmap?requirement=${encodeURIComponent(item.id)}`} onClick={() => changeOpen(false)} className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-2.5 outline-none hover:bg-muted focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{item.agency}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {pages.length === 0 && requirements.length === 0 && <p role="status" className="px-2 py-6 text-sm text-muted-foreground">No results. Try a requirement name or office.</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
