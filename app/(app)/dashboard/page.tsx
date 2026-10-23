"use client"

import { ArrowRight, CalendarDays, ChevronDown, CircleHelp, ExternalLink, Info, MapPin, Pencil, X } from "lucide-react"
import Link from "next/link"

import { RequirementIcon, RequirementTimeline } from "@/components/requirement-row"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ACTIVITY_LABELS, coverageActivities } from "@/lib/activities"
import { buildDashboardSummary, isCompleted } from "@/lib/dashboard-summary"
import { buildCalendar, buildChecklist, getRequirement } from "@/lib/engine"
import { update, useProfile } from "@/lib/store"
import type { ComplianceItem } from "@/lib/types"

const surface = "rounded-2xl border-0 shadow-[0_2px_4px_-2px_rgba(20,42,70,0.05),0_12px_32px_-16px_rgba(20,42,70,0.14)]"
const textLink = "inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

function RequirementPaper({ item }: { item: ComplianceItem }) {
  const office = item.agency.split(/[(/,]/)[0].trim()

  return (
    <div aria-hidden="true" className="relative mx-auto h-52 w-40 shrink-0 select-none @min-[32rem]:mx-0 @min-[32rem]:h-56 @min-[32rem]:w-44">
      <div className="absolute inset-x-1 inset-y-2 rotate-8 rounded-lg bg-primary/10 shadow-sm" />
      <div className="absolute inset-x-0 inset-y-1 -rotate-6 rounded-lg bg-white/65 shadow-sm" />
      <div className="absolute inset-0 rotate-2 overflow-hidden rounded-lg bg-white p-5 text-slate-800 shadow-[0_12px_24px_-8px_rgba(35,65,115,0.25)] [clip-path:polygon(0_0,calc(100%-24px)_0,100%_24px,100%_100%,0_100%)]">
        <div className="absolute top-0 right-0 size-6 rounded-bl-md bg-slate-100 shadow-sm" />
        <div className="flex items-center gap-2 text-primary"><RequirementIcon item={item} className="size-6" /><span className="truncate text-[10px] font-semibold tracking-wide uppercase">{office}</span></div>
        <div className="mt-4 h-px bg-slate-200" />
        <p className="mt-3 text-[9px] font-medium tracking-widest text-slate-500 uppercase">To prepare</p>
        <p className="mt-1 line-clamp-3 text-xs font-semibold leading-snug">{item.name}</p>
        <div className="mt-4 flex flex-col gap-2">
          <div className="h-1 w-full rounded-full bg-slate-100" />
          <div className="h-1 w-4/5 rounded-full bg-slate-100" />
          <div className="h-1 w-3/5 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, items: states, lastDiff } = useProfile()
  if (!profile) return <div className="flex flex-col gap-5" aria-label="Loading dashboard"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>

  const items = buildChecklist(profile, states)
  const summary = buildDashboardSummary(items)
  const next = summary.nextAction
  const upcoming = buildCalendar(profile, items).slice(0, 3)
  const preview = [...items.filter((item) => !isCompleted(item)), ...items.filter(isCompleted)].slice(0, 3)
  const reviewed = items.every((item) => item.lastVerified !== null)
  const limitedActivities = coverageActivities(profile).map((activity) => ACTIVITY_LABELS[activity])
  const allDone = summary.total > 0 && summary.done === summary.total
  const clarify = summary.needsConfirmation > 0 && !summary.awaitingSubmission && !allDone
  const outsideCoverage = profile.city.trim().toLowerCase() !== "manila"
  const showGuidance = summary.needsConfirmation > 0 || limitedActivities.length > 0 || !reviewed || outsideCoverage || profile.stage === "operating_unregistered"
  const location = [profile.barangay && `Barangay ${profile.barangay}`, profile.city].filter(Boolean).join(", ")
  const changed = lastDiff && (lastDiff.added.length > 0 || lastDiff.removed.length > 0)
  const names = (ids: string[]): string => ids.map((id) => getRequirement(id)?.name ?? id).join(", ")

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Dashboard</p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">{profile.businessName || "Your business"}</h1>
          {location && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{location}</p>}
        </div>
        <Link href="/onboarding" className={buttonVariants({ variant: "ghost", className: "rounded-lg text-xs" })}><Pencil data-icon="inline-start" />Edit business</Link>
      </header>

      {changed && <Alert>
        <Info aria-hidden="true" /><AlertTitle>Your roadmap has changed</AlertTitle>
        <AlertDescription>
          {lastDiff.added.length > 0 && <p>Added: {names(lastDiff.added)}.</p>}
          {lastDiff.removed.length > 0 && <p>No longer matched: {names(lastDiff.removed)}.</p>}
        </AlertDescription>
        <AlertAction><Button variant="ghost" size="icon" aria-label="Dismiss roadmap changes" onClick={() => update(() => ({ lastDiff: null }))}><X /></Button></AlertAction>
      </Alert>}

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 min-[1200px]:grid-cols-[minmax(0,1.7fr)_minmax(17rem,1fr)]">
        <Card className={`${surface} @container gap-0 bg-linear-to-br from-secondary to-primary/10 py-0`}>
          <CardContent className="flex h-full flex-col gap-6 p-6 @min-[32rem]:flex-row @min-[32rem]:items-center @min-[32rem]:gap-8 @min-[32rem]:p-7">
            <div className="flex min-w-0 flex-1 flex-col items-start">
              <h2 className="text-xs font-medium text-secondary-foreground">Next action</h2>
              {next ? <>
                <h3 className="mt-3 max-w-md text-[22px] font-semibold leading-tight tracking-tight">{next.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{next.agency}</p>
              </> : <>
                <h3 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight">{allDone ? "Your tracked tasks are complete" : summary.awaitingSubmission ? "Follow up on your submissions" : clarify ? "Clarify your business details" : summary.blocked ? "Check your prerequisites" : "Review your business details"}</h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{allDone ? "Keep an eye on document expiry dates and changes to your business." : summary.awaitingSubmission ? "Update submitted tasks when you receive confirmation." : clarify ? "Review uncertain answers to make your roadmap more specific." : summary.blocked ? "Open your roadmap to see which requirements need to be completed first." : "A clearer profile helps identify your next requirement."}</p>
              </>}
              <Link href={next ? `/roadmap?requirement=${encodeURIComponent(next.id)}` : clarify ? "/onboarding" : "/roadmap"} className={buttonVariants({ className: "mt-6 rounded-xl shadow-[0_4px_12px_-4px_rgba(32,84,255,0.4)]" })}>{next ? "View requirement" : clarify ? "Review business" : "View roadmap"}<ArrowRight data-icon="inline-end" /></Link>
              {next && <a href={next.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Official source<ExternalLink className="size-3" aria-hidden="true" /></a>}
            </div>
            {next && <RequirementPaper item={next} />}
          </CardContent>
        </Card>

        <Card className={`${surface} gap-4 [--card-spacing:--spacing(6)]`}>
          <CardHeader><CardTitle><h2>Tracked progress</h2></CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center gap-4">
            <div>
              <p className="flex items-baseline gap-2 tabular-nums"><span className="text-5xl font-semibold tracking-tighter">{summary.done}</span><span className="text-lg text-muted-foreground">/ {summary.total}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Required tasks completed</p>
            </div>
            <Progress value={summary.total ? summary.done / summary.total * 100 : 0} aria-label={`${summary.done} of ${summary.total} tracked tasks completed`} className="[&_[data-slot=progress-track]]:h-1.5" />
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center gap-2"><dt className="text-muted-foreground">Submitted</dt><dd className="font-semibold tabular-nums">{summary.submitted}</dd></div>
              <div className="flex items-center gap-2"><dt className="text-muted-foreground">Blocked</dt><dd className="font-semibold tabular-nums">{summary.blocked}</dd></div>
            </dl>
          </CardContent>
          <CardFooter><p className="text-xs leading-relaxed text-muted-foreground">Recorded task progress, not a compliance rating.</p></CardFooter>
        </Card>

        <Card className={`${surface} gap-2 [--card-spacing:--spacing(6)]`}>
          <CardHeader><CardTitle><h2>Your roadmap</h2></CardTitle><CardAction><span className="text-xs text-muted-foreground">{items.length} tasks</span></CardAction></CardHeader>
          <CardContent className="flex-1 px-3 sm:px-4">
            <RequirementTimeline items={preview} allItems={items} nextActionId={next?.id} />
            {!preview.length && <Empty className="p-5"><EmptyHeader><EmptyTitle>No requirements matched</EmptyTitle><EmptyDescription>Review your business details to build your roadmap.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
          <CardFooter><Link href="/roadmap" className={textLink}>View full roadmap<ArrowRight className="size-3.5" aria-hidden="true" /></Link></CardFooter>
        </Card>

        <Card className={`${surface} gap-4 [--card-spacing:--spacing(6)]`}>
          <CardHeader><CardTitle><h2>Upcoming dates</h2></CardTitle><CardAction><CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" /></CardAction></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-5">
            {upcoming.map((entry) => {
              const date = new Date(`${entry.due}T00:00:00`)
              return <Link key={entry.id} href="/calendar" className="group flex min-h-11 items-start gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <time dateTime={entry.due} className="flex w-11 shrink-0 flex-col items-center overflow-hidden rounded-lg bg-muted/70 pb-1.5"><span className="w-full bg-secondary py-1 text-center text-[10px] font-medium text-secondary-foreground uppercase">{date.toLocaleDateString("en-PH", { month: "short" })}</span><span className="pt-1 text-lg font-semibold leading-none tabular-nums">{date.getDate()}</span></time>
                <span className="flex min-w-0 flex-col gap-1"><span className="text-sm font-medium leading-snug group-hover:text-primary">{entry.title}</span><span className="text-xs text-muted-foreground">{entry.form}</span>{(entry.id.startsWith("expiry:") || entry.maybe) && <span className="text-xs text-muted-foreground">{entry.id.startsWith("expiry:") ? "Recorded expiry" : "May apply"}</span>}</span>
              </Link>
            })}
            {!upcoming.length && <Empty className="p-0"><EmptyHeader><EmptyTitle>No upcoming dates</EmptyTitle><EmptyDescription>Document dates will appear here when recorded.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-x-3"><Link href="/calendar" className={textLink}>Open calendar<ArrowRight className="size-3.5" aria-hidden="true" /></Link>{upcoming.length > 0 && <span className="text-xs text-muted-foreground">Confirm dates with the office.</span>}</CardFooter>
        </Card>
      </div>

      {showGuidance && <details className="group/guidance rounded-xl text-xs text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-lg py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium text-foreground">{summary.needsConfirmation ? `${summary.needsConfirmation} requirements need confirmation` : "Guidance and coverage"}</span>
          <span>· {limitedActivities.length || outsideCoverage ? "Limited coverage — confirm with your office." : !reviewed ? "Sources need review." : "Review your guidance."}</span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 group-open/guidance:rotate-180" aria-hidden="true" />
        </summary>
        <div className="flex flex-col gap-2 border-l-2 border-border pl-4 leading-relaxed">
          {summary.needsConfirmation > 0 && <p>Some requirements depend on uncertain answers in your business details.</p>}
          {!reviewed && <p>The source library has not yet been reviewed for your city. Confirm requirements with the issuing office.</p>}
          {outsideCoverage && <p>Hermit’s target coverage is the City of Manila.</p>}
          {limitedActivities.length > 0 && <p>Coverage is incomplete for {limitedActivities.join(", ")}. Your roadmap may omit activity-specific requirements.</p>}
          {profile.stage === "operating_unregistered" && <p>If you are already operating, start with registration. Your local Negosyo Center or BIR office can advise on catch-up steps.</p>}
          <Link href="/onboarding" className={textLink}>Review business details<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
        </div>
      </details>}
    </div>
  )
}
