"use client"

import { Check, ChevronDown, ExternalLink, Loader2, MapPin, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { reportProblem } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { buildCalendar, buildChecklist, getRequirement } from "@/lib/engine"
import { formsFor } from "@/lib/forms"
import type { HermitCard, HermitStep } from "@/lib/hermit"
import { mapsLink, officesFor } from "@/lib/offices"
import { PAYABLES } from "@/lib/payments"
import { processFor } from "@/lib/processes"
import { useProfile } from "@/lib/store"
import { cn } from "@/lib/utils"
import { coverage, DOC_TYPES } from "@/lib/vault"

// What Kuya Hermit is doing / did: one row per tool it actually ran.
export function StepTimeline({ steps, live, ms, en }: { steps: HermitStep[]; live?: boolean; ms?: number; en: boolean }) {
  if (!steps.length && !live) return null
  const sources = new Set(steps.map((s) => s.source)).size
  const rows = (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={s.id ?? i} className="flex items-start gap-2">
          <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full", s.done ? (s.ok === false ? "bg-amber-500" : "bg-emerald-600") : "bg-muted-foreground/30")}>
            {s.done ? s.ok === false ? <X className="size-3 text-white" /> : <Check className="size-3 text-white" /> : <Loader2 className="size-3 animate-spin" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block">{s.label}</span>
            {s.detail && <span className="block text-muted-foreground">{s.detail}</span>}
          </span>
          <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">{s.source}</span>
        </li>
      ))}
    </ol>
  )
  if (live)
    return (
      <div className="flex flex-col gap-2 text-xs">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {en ? "Working on it…" : "Inaasikaso ko na…"}
        </p>
        {rows}
      </div>
    )
  return (
    <details className="group text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground">
        <Check className="size-3.5 text-emerald-600" />
        {en
          ? `Completed ${steps.length} step${steps.length === 1 ? "" : "s"} across ${sources} source${sources === 1 ? "" : "s"}`
          : `Natapos ang ${steps.length} hakbang sa ${sources} source`}
        {ms ? ` · ${(ms / 1000).toFixed(1)}s` : ""}
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">{rows}</div>
    </details>
  )
}

export function HermitCards({ cards, onAsk }: { cards: HermitCard[]; onAsk: (q: string) => void }) {
  return cards.map((c, i) =>
    c.kind === "requirement" ? (
      <RequirementCard key={i} id={c.id} onAsk={onAsk} />
    ) : c.kind === "deadlines" ? (
      <DeadlinesCard key={i} months={c.months} />
    ) : c.kind === "offices" ? (
      <OfficesCard key={i} />
    ) : (
      <ReportCard key={i} office={c.office} message={c.message} />
    )
  )
}

const card = "flex flex-col gap-2 rounded-xl border bg-background p-3 text-xs"

function RequirementCard({ id, onAsk }: { id: string; onAsk: (q: string) => void }) {
  const { profile, docs } = useProfile()
  const r = getRequirement(id)
  if (!profile || !r) return null
  const en = profile.lang === "en"
  const needs = coverage(id, docs)?.needs ?? []
  const forms = formsFor(id, profile)
  const start = processFor(id, profile)?.links[0]
  return (
    <div className={card}>
      <div>
        <p className="text-sm font-medium">{r.name}</p>
        <p className="text-muted-foreground">{r.agency}</p>
      </div>
      {needs.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {needs.map((s) => {
            const ok = s.doc && s.doc.verdict !== "rejected"
            return (
              <li key={s.types.join()} className={ok ? undefined : "text-amber-700 dark:text-amber-400"}>
                {ok ? "✓" : "✗"} {s.types.map((t) => DOC_TYPES[t].name).join(" / ")}
                <span className="text-muted-foreground">{ok ? (en ? " · in your vault" : " · nasa vault mo") : en ? " · not in your vault" : " · wala pa sa vault"}</span>
              </li>
            )
          })}
        </ul>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">{en ? "Fee" : "Bayad"}</dt>
        <dd>{r.fee}</dd>
        <dt className="text-muted-foreground">{en ? "Time" : "Tagal"}</dt>
        <dd>{r.processingTime}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        {start && (
          <a href={start.url} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })}>
            {start.label} <ExternalLink />
          </a>
        )}
        {forms.slice(0, 2).map((f) => (
          <Link key={f.id} href={`/forms/${f.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Pre-fill {f.short}
          </Link>
        ))}
        {(forms.length > 0 || needs.length > 0) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAsk(en ? `Yes, prepare the documents for ${r.name}` : `Oo, ihanda mo ang mga dokumento para sa ${r.name}`)}
          >
            {en ? "Prepare PDF packet" : "Ihanda ang PDF packet"}
          </Button>
        )}
        {needs.some((s) => !s.doc) && (
          <Link href="/vault" className={buttonVariants({ size: "sm", variant: "ghost" })}>
            {en ? "Upload documents" : "Mag-upload"}
          </Link>
        )}
      </div>
    </div>
  )
}

function DeadlinesCard({ months }: { months: number }) {
  const { profile, items } = useProfile()
  const [now] = useState(() => Date.now())
  if (!profile) return null
  const en = profile.lang === "en"
  const list = buildCalendar(profile, buildChecklist(profile, items), new Date(), months).slice(0, 6)
  const days = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00`) - now) / 86_400_000)
  if (!list.length) return null
  return (
    <div className={card}>
      <p className="text-sm font-medium">{en ? `Deadlines, next ${months} month${months === 1 ? "" : "s"}` : `Mga deadline, susunod na ${months} buwan`}</p>
      <ul className="flex flex-col divide-y">
        {list.map((d) => {
          const pay = PAYABLES.find((p) => p.deadlineId === d.id.split(":")[0])
          const left = days(d.due)
          return (
            <li key={d.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0">
                <span className="block truncate">{d.title}</span>
                <span className="text-muted-foreground">
                  {d.due} · {left <= 0 ? (en ? "today" : "ngayon") : en ? `in ${left} days` : `${left} araw pa`}
                  {d.maybe ? (en ? " · possibly" : " · posible") : ""}
                </span>
              </span>
              {pay && (
                <Link href={`/pay?form=${pay.formId}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                  {en ? "Pay" : "Magbayad"}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      <Link href="/calendar" className="text-primary">
        {en ? "Open calendar →" : "Buksan ang kalendaryo →"}
      </Link>
    </div>
  )
}

function OfficesCard() {
  const { profile, items } = useProfile()
  if (!profile) return null
  const en = profile.lang === "en"
  const types = new Set(buildChecklist(profile, items).map((i) => i.officeType))
  const list = officesFor(profile.city, profile.barangay, types, profile)
  return (
    <div className={card}>
      <p className="text-sm font-medium">{en ? "Your offices" : "Mga opisina mo"}</p>
      <ul className="flex flex-col divide-y">
        {list.map((o) => (
          <li key={o.name} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0">
              <span className="block">{o.name}</span>
              <span className="text-muted-foreground">{o.note}</span>
            </span>
            <a href={mapsLink(o, profile.city)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "icon-sm", variant: "outline" })} aria-label={`Directions to ${o.name}`}>
              <MapPin />
            </a>
          </li>
        ))}
      </ul>
      <Link href="/offices" className="text-primary">
        {en ? "Find the nearest on the map →" : "Hanapin ang pinakamalapit sa mapa →"}
      </Link>
    </div>
  )
}

// A draft Kuya Hermit wrote; only the owner's tap submits it.
function ReportCard({ office: initialOffice, message: initialMessage }: { office: string; message: string }) {
  const { profile } = useProfile()
  const [office, setOffice] = useState(initialOffice)
  const [message, setMessage] = useState(initialMessage)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; caseNumber?: string; error?: string }>()
  const en = profile?.lang === "en"
  if (result?.ok)
    return (
      <div className={card}>
        <p className="text-sm font-medium">{en ? "eReport submitted" : "Naisumite ang eReport"}</p>
        <p>
          {en ? "Case number" : "Case number"}: <span className="font-mono">{result.caseNumber}</span>
        </p>
      </div>
    )
  return (
    <div className={card}>
      <p className="text-sm font-medium">{en ? "eReport draft: review before sending" : "Draft ng eReport: suriin bago ipadala"}</p>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">{en ? "Office" : "Opisina"}</span>
        <input className="h-9 rounded-lg border bg-background px-2 text-sm" value={office} onChange={(e) => setOffice(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">{en ? "What happened" : "Ano ang nangyari"}</span>
        <textarea className="min-h-24 rounded-lg border bg-background p-2 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <Button
        size="sm"
        disabled={busy || !office.trim() || !message.trim()}
        onClick={async () => {
          setBusy(true)
          setResult(await reportProblem({ office, message }).catch(() => ({ ok: false, error: "Report failed, try again later" })))
          setBusy(false)
        }}
      >
        {busy ? (en ? "Sending…" : "Ipinapadala…") : en ? "Submit to eReport" : "Isumite sa eReport"}
      </Button>
      <p className="text-muted-foreground">
        {en ? "Goes to the government's eReport desk under your eGovPH identity." : "Mapupunta sa eReport ng gobyerno gamit ang eGovPH identity mo."}
      </p>
      {result?.error && <p role="alert" className="text-destructive">{result.error}</p>}
    </div>
  )
}
