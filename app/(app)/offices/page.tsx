"use client"

import { ExternalLink, MapPin } from "lucide-react"
import { useState, useTransition } from "react"

import { reportProblem } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { buildChecklist } from "@/lib/engine"
import { mapsLink, officesFor, PILOT_CITY } from "@/lib/offices"
import { useProfile } from "@/lib/store"

export default function OfficesPage() {
  const { profile, items } = useProfile()
  if (!profile) return null

  const types = new Set(buildChecklist(profile, items).map((i) => i.officeType))
  types.add("negosyo_center")
  const offices = officesFor(profile.city, profile.barangay, types)
  const pilot = profile.city.trim().toLowerCase() === PILOT_CITY.toLowerCase()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mga opisina mo</h1>
        <p className="text-sm text-muted-foreground">
          Ang mga opisinang may hawak sa negosyo mo sa {[profile.barangay && `Brgy. ${profile.barangay}`, profile.city].filter(Boolean).join(", ") || "lugar mo"}.
        </p>
      </div>
      {!pilot && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Wala pa kaming verified na office data para sa {profile.city || "lungsod mo"} — {PILOT_CITY} pa lang ang pilot city. Ask
          your city hall or the nearest Negosyo Center.
        </p>
      )}
      {offices.map((o) => (
        <div key={o.type + o.name} className="flex flex-col gap-2 rounded-2xl border p-4 text-sm">
          <p className="font-medium">{o.name}</p>
          <p className="text-muted-foreground">{o.note}</p>
          <div className="flex flex-wrap gap-2">
            <a href={mapsLink(o, profile.city)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
              <MapPin /> Directions
            </a>
            {o.url && (
              <a href={o.url} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                Official site <ExternalLink />
              </a>
            )}
          </div>
          <ReportRedTape office={o.name} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Official links only. Walang &quot;fixer&quot; ang HERMIT — kung may humihingi ng bayad para mapabilis, i-report ito.
        Office data is a seed list; confirm hours and contact details with each office.
      </p>
    </div>
  )
}

function ReportRedTape({ office }: { office: string }) {
  const [msg, setMsg] = useState("")
  const [result, setResult] = useState<string>()
  const [pending, start] = useTransition()
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">May problema? I-report sa eReport</summary>
      <form
        className="mt-2 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const r = await reportProblem({ office, message: msg })
            setResult(r.ok ? `Na-file ✓ Case no. ${r.caseNumber}` : r.error)
            if (r.ok) setMsg("")
          })
        }}
      >
        <textarea
          className="h-20 rounded-lg border bg-background p-2 text-sm"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Ano ang nangyari? (fixer, pinapabalik-balik, walang resibo…)"
          aria-label="Describe the problem"
        />
        <Button size="sm" type="submit" disabled={pending || !msg.trim()} className="self-start">
          I-submit
        </Button>
        {result && <p>{result}</p>}
      </form>
    </details>
  )
}
