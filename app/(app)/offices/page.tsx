"use client"

import { Building2, ExternalLink, LocateFixed, MapPin, Navigation } from "lucide-react"
import { useState, useTransition } from "react"

import { reportProblem } from "@/app/actions"
import { findNearbyOffices } from "@/app/maps"
import { COLORS, mapsOnPage, OfficeMap } from "@/components/office-map"
import { Button, buttonVariants } from "@/components/ui/button"
import { buildChecklist } from "@/lib/engine"
import { directionsUrl, OFFICE_SEARCH, type NearbyOffice } from "@/lib/nearby"
import { mapsLink, officesFor, PILOT_CITY } from "@/lib/offices"
import { useProfile } from "@/lib/store"
import type { OfficeType } from "@/lib/types"

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
          Ang mga opisinang kailangan mo para sa negosyo sa {[profile.barangay && `Brgy. ${profile.barangay}`, profile.city].filter(Boolean).join(", ") || "lugar mo"}.
        </p>
      </div>

      <NearMe
        types={[...types]}
        city={profile.city}
        barangay={profile.barangay}
        address={[profile.businessAddress, profile.barangay && `Barangay ${profile.barangay}`, profile.city, "Philippines"].filter(Boolean).join(", ")}
      />

      <h2 className="pt-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">May hawak sa iyo · Your offices</h2>
      {!pilot && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Wala pa kaming verified na office data para sa {profile.city || "lungsod mo"} — {PILOT_CITY} pa lang ang pilot city. Gamitin
          ang mapa sa itaas, at itanong sa city hall o Negosyo Center kung alin ang may hawak sa iyo.
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

// Nearest real offices from Google Maps, around the owner's location or business address.
function NearMe({ types, city, barangay, address }: { types: OfficeType[]; city: string; barangay: string; address: string }) {
  const [state, setState] = useState<{ center: { lat: number; lng: number }; offices: NearbyOffice[] } | null>(null)
  const [error, setError] = useState<string>()
  const [selected, setSelected] = useState<string>()
  const [pending, start] = useTransition()

  if (!mapsOnPage) return null

  function run(where: { lat: number; lng: number } | null) {
    setError(undefined)
    start(async () => {
      const r = await findNearbyOffices({ ...(where ?? { address }), city, barangay, types })
      if (!r.ok) setError(r.error === "no_key" ? "Hindi pa naka-connect ang Google Maps." : r.error)
      else setState({ center: r.center ?? where!, offices: r.offices })
    })
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Hindi available ang lokasyon sa browser na ito.")
    setError(undefined)
    navigator.geolocation.getCurrentPosition(
      (p) => run({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Hindi nakuha ang lokasyon mo. Payagan ang location, o gamitin ang address ng negosyo."),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 }
    )
  }

  const byType = state ? Map.groupBy(state.offices, (o) => o.type) : null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Malapit sa iyo · Near you</h2>
      <div className="flex flex-wrap gap-2">
        <Button onClick={useMyLocation} disabled={pending}>
          <LocateFixed /> Gamitin ang lokasyon ko
        </Button>
        <Button variant="outline" onClick={() => run(null)} disabled={pending || !city}>
          <Building2 /> Gamitin ang address ng negosyo
        </Button>
      </div>
      {pending && <p className="text-sm text-muted-foreground">Hinahanap ang mga opisina…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {state && (
        <>
          <OfficeMap center={state.center} offices={state.offices} selected={selected} onSelect={setSelected} />
          {state.offices.length === 0 && <p className="text-sm">Walang nahanap na opisina sa paligid. Subukan ang address ng negosyo.</p>}
          {byType &&
            [...byType].map(([type, list]) => {
              const s = OFFICE_SEARCH[type]!
              return (
                <div key={type} className="flex flex-col gap-1.5 rounded-2xl border p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="size-3 rounded-full" style={{ background: COLORS[type] }} aria-hidden />
                    {s.label}
                  </p>
                  {s.jurisdiction && <p className="text-xs text-amber-700 dark:text-amber-400">{s.jurisdiction}</p>}
                  <ul className="flex flex-col divide-y">
                    {list.map((o) => (
                      <li key={o.placeId} className="flex items-center justify-between gap-3 py-2">
                        <button className="min-w-0 text-left" onClick={() => setSelected(o.placeId)}>
                          <span className="block truncate font-medium">{o.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {o.km} km · {o.address}
                          </span>
                        </button>
                        <a href={directionsUrl(o)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
                          <Navigation /> Puntahan
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          <p className="text-[11px] text-muted-foreground">Mula sa Google Maps. Ang pinakamalapit ay hindi palaging ang may hawak sa iyo.</p>
        </>
      )}
    </section>
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
