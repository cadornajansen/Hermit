"use client"

import { ArrowLeft, CircleHelp, ListChecks, Search } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { RequirementDetails } from "@/components/requirement-details"
import { RequirementTimeline } from "@/components/requirement-row"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ACTIVITY_LABELS, coverageActivities } from "@/lib/activities"
import { buildDashboardSummary, getBlockers, isCompleted } from "@/lib/dashboard-summary"
import { buildChecklist } from "@/lib/engine"
import { useProfile } from "@/lib/store"
import type { ComplianceItem, Group } from "@/lib/types"

const GROUPS: [Group, string][] = [["start", "Get registered"], ["operate", "Run your business"], ["hire", "Employ your team"], ["renew", "Keep up to date"]]
const FILTERS = { all: "All statuses", not_started: "Not started", in_progress: "In progress", submitted: "Submitted", completed: "Completed", blocked: "Blocked", confirm: "Needs confirmation" }
type Filter = keyof typeof FILTERS

export function Roadmap() {
  const { profile, items: states, docs } = useProfile()
  const params = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  if (!profile) return <Skeleton className="h-96 w-full" />

  const items = buildChecklist(profile, states)
  const summary = buildDashboardSummary(items)
  const limitedActivities = coverageActivities(profile).map((activity) => ACTIVITY_LABELS[activity])
  const selectedId = params.get("requirement")
  const selected = items.find((item) => item.id === selectedId)
  const term = query.trim().toLowerCase()
  const matches = (item: ComplianceItem): boolean => {
    if (term && !`${item.name} ${item.agency}`.toLowerCase().includes(term)) return false
    if (filter === "all") return true
    if (filter === "completed") return isCompleted(item)
    if (filter === "confirm") return item.applies === "maybe"
    if (filter === "blocked") return !isCompleted(item) && item.status !== "submitted" && getBlockers(item, items).length > 0
    return item.status === filter
  }
  const visible = items.filter(matches)

  function closeRequirement(): void {
    const next = new URLSearchParams(params.toString())
    next.delete("requirement")
    router.replace(`/roadmap${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  return (
    <div className="flex w-full min-w-0 max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5"><h1 className="text-2xl font-semibold tracking-tight">Your roadmap</h1><p className="text-sm text-muted-foreground">{items.length} tracked requirements · {profile.businessName || "Your business"}</p></div>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}><ArrowLeft data-icon="inline-start" />Overview</Link>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="min-w-0 flex-1 gap-2">
          <FieldLabel htmlFor="roadmap-search" className="sr-only">Search requirements</FieldLabel>
          <div className="relative"><Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden="true" /><Input id="roadmap-search" className="h-11 rounded-xl bg-background pl-10 md:text-sm" placeholder="Search requirements or offices" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        </Field>
        <Select value={filter} onValueChange={(value) => { if (value && value in FILTERS) setFilter(value as Filter) }} items={FILTERS}>
          <SelectTrigger className="w-full rounded-xl bg-background data-[size=default]:h-11 sm:w-48" aria-label="Filter requirements by status"><SelectValue /></SelectTrigger>
          <SelectContent align="start" sideOffset={8} alignItemWithTrigger={false} className="rounded-xl"><SelectGroup>{Object.entries(FILTERS).map(([key, label]) => <SelectItem key={key} value={key} className="min-h-11">{label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </div>
      <div className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>Confirm unreviewed requirements with the issuing office.{limitedActivities.length > 0 && <> Coverage for {limitedActivities.join(", ")} is incomplete; other requirements may apply even after your tracked tasks are complete.</>}</p>
      </div>
      {selectedId && !selected && <Alert><AlertDescription>This requirement is no longer in your current roadmap. <Button variant="link" onClick={closeRequirement}>Dismiss</Button></AlertDescription></Alert>}
      {(term || filter !== "all") && <p className="text-xs text-muted-foreground" role="status">{visible.length} of {items.length} requirements</p>}
      {GROUPS.map(([group, label], index) => {
        const list = visible.filter((item) => item.group === group)
        if (!list.length) return null
        return (
          <section key={group} className="rounded-2xl bg-card px-3 py-5 shadow-[0_4px_24px_-10px_rgba(31,52,85,0.14)] ring-1 ring-foreground/[0.025] sm:px-6 sm:py-6" aria-label={label}>
            <header className="mb-4 flex items-center gap-3 px-2">
              <span className="text-xs font-medium tabular-nums text-muted-foreground/70" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="text-sm font-semibold">{label}</h2>
              <span className="ml-auto text-xs text-muted-foreground">{list.length} {list.length === 1 ? "task" : "tasks"}</span>
            </header>
            <RequirementTimeline items={list} allItems={items} nextActionId={summary.nextAction?.id} />
          </section>
        )
      })}
      {!visible.length && <Empty><EmptyHeader><EmptyMedia variant="icon"><ListChecks /></EmptyMedia><EmptyTitle>No matching requirements</EmptyTitle><EmptyDescription>Try another search or reset the status filter.</EmptyDescription></EmptyHeader><Button variant="outline" onClick={() => { setQuery(""); setFilter("all") }}>Clear filters</Button></Empty>}
      {selected && <RequirementDetails key={selected.id} item={selected} items={items} docs={docs} profile={profile} onClose={closeRequirement} />}
    </div>
  )
}
