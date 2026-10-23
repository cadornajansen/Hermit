"use client"

import { ExternalLink, LocateFixed, MapPin, Navigation } from "lucide-react"
import { useEffect, useId, useRef, useState, useTransition } from "react"

import { reportProblem } from "@/app/actions"
import { geocodeOrigin } from "@/app/maps"
import { LocationFields } from "@/components/location-fields"
import { OfficeMap } from "@/components/office-map"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildChecklist, REQUIREMENTS } from "@/lib/engine"
import type { GeocodeCandidate } from "@/lib/google-geocoding"
import { jurisdictionLabel, resolveLocation, type LocationValue } from "@/lib/locations"
import { findManilaBarangay, MANILA_BARANGAYS } from "@/lib/manila-barangays"
import { businessSearchAddress, directionsUrl, mapsSearchUrl, type Point } from "@/lib/nearby"
import { DEMO_OFFICES } from "@/lib/office-demo"
import { distanceLabel, eligibleOffices, rankOffices, validPoint, type EligibleOffice } from "@/lib/office-finder"
import { OFFICE_REGISTRY } from "@/lib/office-registry"
import { mapsLink, officesFor } from "@/lib/offices"
import { processFor } from "@/lib/processes"
import { useProfile } from "@/lib/store"
import type { ItemState, Profile } from "@/lib/types"

export type SearchOrigin = { point: Point; label: string; source: "device" | "search"; accuracy?: number }

export function OfficeFinder({ initialService, enabled, canGeocode, demo = false }: { initialService: string; enabled: boolean; canGeocode: boolean; demo?: boolean }) {
  const { profile, items, ownerId } = useProfile()
  if (!profile) return null
  return <OfficeFinderPanel key={JSON.stringify([ownerId, profile.businessName, profile.businessAddress, profile.city, profile.province, profile.region, profile.barangay, initialService])} profile={profile} items={items} initialService={initialService} enabled={enabled} canGeocode={canGeocode} demo={demo} />
}

export function OfficeFinderPanel({ profile, items, initialService = "", enabled, canGeocode, demo = false }: {
  profile: Profile; items: Record<string, ItemState>; initialService?: string; enabled: boolean; canGeocode: boolean; demo?: boolean
}) {
  const [service, setService] = useState(REQUIREMENTS.some((entry) => entry.id === initialService) ? initialService : "")
  const [area, setArea] = useState<LocationValue>(profile)
  const [assignment, setAssignment] = useState("")
  const [confirmed, setConfirmed] = useState<{ service: string; area: LocationValue; assignment: string }>()
  const [origin, setOrigin] = useState<SearchOrigin>()
  const [mapConsent, setMapConsent] = useState(false)
  const registry = demo ? [...OFFICE_REGISTRY, ...DEMO_OFFICES] : OFFICE_REGISTRY
  const result = confirmed ? eligibleOffices(confirmed.service, confirmed.area, confirmed.assignment, registry) : null
  const assignments = service ? eligibleOffices(service, area, "", registry).assignments : []
  const requirement = REQUIREMENTS.find((entry) => entry.id === confirmed?.service)
  const process = confirmed && processFor(confirmed.service, confirmed.area)
  const manilaBarangay = confirmed && resolveLocation(confirmed.area).city?.code === "1380600000"
    ? findManilaBarangay(confirmed.area.barangay ?? "") : undefined
  const barangayQuery = (area.barangay ?? "").toLowerCase().trim().replace(/^(?:brgy\.?|barangay)\s+/, "")
  const barangayChoices = MANILA_BARANGAYS.filter((barangay) =>
    !barangayQuery || barangay.name.toLowerCase().replace(/^barangay\s+/, "").includes(barangayQuery)).slice(0, 50)
  const checklistItem = buildChecklist(profile, items).find((entry) => entry.id === confirmed?.service)
  const legacy = requirement && resolveLocation(confirmed!.area).city?.code !== "1380600000"
    ? officesFor(confirmed!.area.city, confirmed!.area.barangay ?? "", new Set([requirement.officeType]), confirmed!.area) : []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Office finder</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Find an office verified to handle your document or service and serve your business area. Proximity does not determine jurisdiction.</p>
      </header>
      <form className="flex flex-col gap-4 rounded-xl border bg-background p-4 sm:p-5" onSubmit={(event) => {
        event.preventDefault()
        if (REQUIREMENTS.some((entry) => entry.id === service) && resolveLocation(area).city) setConfirmed({ service, area: { ...area }, assignment: assignment.trim() })
      }}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="office-service" className="text-sm font-medium">Document or service</label>
            <select id="office-service" required value={service} onChange={(event) => { setService(event.target.value); setAssignment("") }} className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Choose a document or service</option>
              {REQUIREMENTS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Business jurisdiction</span>
            <p>{jurisdictionLabel(area)}{area.barangay ? ` · ${area.barangay}` : ""}</p>
            <p className="text-xs text-muted-foreground">Your starting point below changes distances only.</p>
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer py-2 font-medium">Confirm or change the business service area</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <LocationFields value={area} onChange={(next) => { setArea(next); setAssignment("") }} />
            <div className="flex flex-col gap-3">
              <label htmlFor="office-barangay">Barangay</label>
              <Input id="office-barangay" list={resolveLocation(area).city?.code === "1380600000" ? "manila-barangay-options" : undefined} value={area.barangay ?? ""} maxLength={100} onChange={(event) => { setArea({ ...area, barangay: event.target.value }); setAssignment("") }} />
              {resolveLocation(area).city?.code === "1380600000" && <>
                <datalist id="manila-barangay-options">{barangayChoices.map((barangay) => <option key={barangay.code} value={barangay.name} label={barangay.district} />)}</datalist>
                <p className="text-xs text-muted-foreground">Type your barangay number or name to search Manila&apos;s 897 PSA-listed barangays. These names identify the jurisdiction, not the hall address.</p>
              </>}
              {assignments.length > 0 && <>
                <label htmlFor="office-assignment">Agency-assigned branch</label>
                <select id="office-assignment" value={assignment} onChange={(event) => setAssignment(event.target.value)} aria-describedby="office-assignment-help" className="min-h-11 rounded-xl border bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Confirm your assigned branch with the agency</option>
                  {assignments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.id})</option>)}
                </select>
              </>}
              <p id="office-assignment-help" className="text-xs text-muted-foreground">If branch assignment is required, select a branch only after agency confirmation. These area changes apply to this search, not your saved business profile.</p>
            </div>
          </div>
        </details>
        <Button type="submit" disabled={!service || !resolveLocation(area).city} className="self-start">Find eligible offices</Button>
      </form>

      {result && requirement && <section className="flex flex-col gap-4" aria-label="Office search results">
        <div className="flex flex-col gap-2" aria-live="polite">
          <h2 className="text-lg font-semibold">{requirement.name}</h2>
          <p className="text-sm text-muted-foreground">Showing service coverage for {jurisdictionLabel(confirmed!.area)}{confirmed!.area.barangay ? ` · ${confirmed!.area.barangay}` : ""}.</p>
          {(!checklistItem || checklistItem.applies === "maybe") && <p className="text-sm">Confirm with the agency whether this service is required for your business.</p>}
          {result.needsReview > 0 && <p role="status" className="text-sm">{result.needsReview} matching record(s) need service or coverage review and are excluded from eligible results.</p>}
          {result.needsAssignment > 0 && <p role="status" className="text-sm">{result.needsAssignment} branch record(s) require a confirmed agency assignment. Proximity cannot choose your assigned office.</p>}
        </div>
        {process && process.links.length > 0 && <div className="rounded-xl border bg-background p-4 text-sm">
          <h3 className="font-semibold">Online filing option</h3>
          <ul className="mt-2 flex flex-col gap-2">{process.links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">{link.label}<ExternalLink className="size-4" aria-hidden /></a></li>)}</ul>
          {process.note && <p className="mt-2 text-xs text-muted-foreground">{process.note}</p>}
        </div>}
        {(confirmed!.service === "brgy_clearance" || confirmed!.service === "brgy_renewal") && resolveLocation(confirmed!.area).city?.code === "1380600000" && <div className="rounded-xl border bg-background p-4 text-sm">
          <h3 className="font-semibold">Your Manila barangay</h3>
          {manilaBarangay ? <>
            <p className="mt-2">{manilaBarangay.name} · {manilaBarangay.district} · PSGC {manilaBarangay.code}</p>
            <p className="mt-2 text-muted-foreground">Manila integrates barangay business clearance with the Bureau of Permits application. The PSA verifies this barangay&apos;s identity and district; its hall address and separate clearance counter have not been verified. Visit the hall only if the city or barangay directs you there.</p>
            <a href={mapsSearchUrl(`${manilaBarangay.name} Hall, ${manilaBarangay.district}, City of Manila, Philippines`)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">Search for the hall on Google Maps (unverified)<ExternalLink className="size-4" aria-hidden /></a>
          </> : <p className="mt-2 text-muted-foreground">Enter your barangay&apos;s number or PSA-listed name above to identify its district. A map search cannot verify a hall or clearance counter.</p>}
        </div>}
        {!result.offices.length && <div role="status" className="rounded-xl border bg-background p-5 text-sm">
          <p className="font-medium">Verified office coverage is not yet available for this service and area.</p>
          <p className="mt-2 text-muted-foreground">This does not mean no offices exist. Confirm the correct branch with the agency; map search results cannot verify that it processes your document.</p>
          <a href={requirement.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">Official agency guidance <ExternalLink className="size-4" aria-hidden /></a>
        </div>}
        <OriginSearch canGeocode={canGeocode} businessAddress={businessSearchAddress(profile)} origin={origin} onOrigin={setOrigin} />
        <p className="text-xs text-muted-foreground">Google receives your IP and map viewport when you load its map. Precise location and entered addresses stay out of Hermit&apos;s saved profile, chat, and analytics. Address searches are processed by Hermit and Google. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-4">Google privacy</a> · <a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noreferrer" className="underline underline-offset-4">Google Maps terms</a></p>
        {!enabled && <p role="status" className="text-sm text-muted-foreground">Interactive maps and address search have not been enabled. Verified textual results and official links remain available.</p>}
        {enabled && !mapConsent && <Button variant="outline" onClick={() => setMapConsent(true)} className="self-start"><MapPin aria-hidden />Show Google map</Button>}
        <OfficeResults key={`${confirmed!.service}:${jurisdictionLabel(confirmed!.area)}:${confirmed!.area.barangay}:${confirmed!.assignment}`} offices={result.offices} origin={origin} showMap={enabled && mapConsent} />
        {legacy.length > 0 && <details className="rounded-xl border bg-background p-4 text-sm">
          <summary className="cursor-pointer font-medium">Legacy office guidance — eligibility unverified</summary>
          <p className="mt-3 text-muted-foreground">These historical seed records do not verify branch identity, coordinates, service eligibility, or jurisdiction. Confirm all details with the agency.</p>
          <ul className="divide-y">{legacy.map((office) => <li key={office.type + office.name} className="flex flex-col items-start gap-2 py-4">
            <p className="font-medium">{office.name}</p><p>{office.note}</p>
            <a href={mapsLink(office, confirmed!.area.city)} target="_blank" rel="noreferrer" className="min-h-11 py-2 text-primary underline underline-offset-4">Search name on Google Maps (unverified)</a>
            {office.url && <a href={office.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">Official site</a>}
            <ReportRedTape office={office.name} />
          </li>)}</ul>
        </details>}
      </section>}
    </div>
  )
}

const SEARCH_ERRORS = {
  disabled: "Address search has not been enabled. You can still use the textual office list.",
  no_key: "Google address search is not configured. You can still use device location or the textual list.",
  invalid: "Enter a city, barangay, or address between 3 and 300 characters.",
  quota: "The address-search limit has been reached. Wait before retrying; the office list is still available.",
  unavailable: "Google address search or its usage controls are unavailable. Your starting point has not changed. Try again later.",
}

export function OriginSearch({ canGeocode, businessAddress, origin, onOrigin }: {
  canGeocode: boolean; businessAddress: string; origin?: SearchOrigin; onOrigin: (value: SearchOrigin | undefined) => void
}) {
  const [query, setQuery] = useState("")
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [locating, setLocating] = useState(false)
  const [pending, start] = useTransition()
  const [cooldown, setCooldown] = useState(false)
  const [lastQuery, setLastQuery] = useState("")
  const request = useRef(0)
  const busy = useRef(false)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { request.current++; clearTimeout(cooldownTimer.current) }, [])

  function search(value: string) {
    if (!canGeocode || cooldown || busy.current) return
    busy.current = true
    const id = ++request.current
    setError(""); setMessage(""); setCandidates([]); setLastQuery(value)
    start(async () => {
      try {
        const response = await geocodeOrigin(value)
        if (id !== request.current) return
        if (!response.ok) {
          setError(SEARCH_ERRORS[response.error])
          if (response.retryAfterSeconds) {
            setCooldown(true)
            cooldownTimer.current = setTimeout(() => setCooldown(false), response.retryAfterSeconds * 1000)
          }
        } else {
          setCandidates(response.candidates)
          setMessage(response.candidates.length ? `${response.partial ? "Partial matches: some results were omitted. " : ""}Confirm a starting point below. Your previous starting point stays in use until you confirm.` : "No address matches. Edit the city, barangay, or address and search again. Your starting point has not changed.")
        }
      } catch {
        if (id === request.current) setError(SEARCH_ERRORS.unavailable)
      } finally { if (id === request.current) busy.current = false }
    })
  }

  function locate() {
    if (busy.current) return
    setCandidates([]); setMessage(""); setError(""); setLastQuery("")
    if (!navigator.geolocation) { setError("Device location is unavailable. Enter a city, barangay, or address below."); return }
    busy.current = true
    setLocating(true)
    const id = ++request.current
    navigator.geolocation.getCurrentPosition((position) => {
      if (id !== request.current) return
      busy.current = false; setLocating(false)
      const point = { lat: position.coords.latitude, lng: position.coords.longitude }
      if (!validPoint(point) || !Number.isFinite(position.coords.accuracy) || position.coords.accuracy < 0 || !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 300_000) {
        setError("The device position is stale or invalid. Request a fresh position or enter a starting address."); return
      }
      onOrigin({ point, label: "Device location", source: "device", accuracy: position.coords.accuracy })
    }, (failure) => {
      if (id !== request.current) return
      busy.current = false; setLocating(false)
      setError(failure.code === 1 ? "Location permission was denied. Your choice is preserved; enter a city, barangay, or address below." : "Device location could not be obtained. Try the location button again or enter a city, barangay, or address below.")
    }, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 })
  }

  return <section aria-label="Search starting point" className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:p-5">
    <h3 className="font-semibold">Choose a starting point</h3>
    <p className="text-sm text-muted-foreground">Optional: compare approximate straight-line distances. Device location is requested only when you press the button and is kept in this page&apos;s memory.</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={locate} disabled={pending || locating}><LocateFixed aria-hidden />{locating ? "Locating…" : "Use device location"}</Button>
      {origin && <Button variant="ghost" onClick={() => onOrigin(undefined)} disabled={pending || locating}>Clear starting point</Button>}
    </div>
    <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); search(query) }}>
      <label htmlFor="office-origin" className="text-sm font-medium">City, barangay, or starting address</label>
      <Input id="office-origin" value={query} minLength={3} maxLength={300} required autoComplete="off" disabled={pending || locating} onChange={(event) => { setQuery(event.target.value); setCandidates([]) }} aria-describedby="office-origin-help" />
      <p id="office-origin-help" className="text-xs text-muted-foreground">Searching sends this text to Hermit and Google. Area centers are approximate; review each match before using it.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canGeocode || pending || locating || cooldown}>Search starting address</Button>
        <Button type="button" variant="outline" disabled={!canGeocode || pending || locating || cooldown} onClick={() => { setQuery(businessAddress); search(businessAddress) }}>Search saved business address</Button>
      </div>
    </form>
    {!canGeocode && <p className="text-sm text-muted-foreground">Address search needs Google configuration and the office-finder feature enabled. Device location and the office list remain available.</p>}
    {pending && <p role="status" className="text-sm">Searching Google Maps…</p>}
    {error && <div role="alert" className="flex flex-col items-start gap-2 text-sm"><p>{error}</p>{lastQuery && <Button variant="outline" disabled={pending || locating || cooldown} onClick={() => search(lastQuery)}>Retry same address</Button>}</div>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {candidates.length > 0 && <ul className="divide-y">{candidates.map((candidate) => <li key={candidate.id} className="py-2">
      <Button variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" onClick={() => {
        onOrigin({ point: candidate.point, label: `${candidate.label}${candidate.approximate ? " (approximate area/address match)" : ""}`, source: "search" })
        setCandidates([]); setMessage("")
      }}>Use {candidate.label}{candidate.approximate ? " — approximate area/address match" : ""}</Button>
    </li>)}</ul>}
    {(candidates.length > 0 || origin?.source === "search") && <p className="text-xs text-muted-foreground">Address results from <span translate="no" className="whitespace-nowrap bg-white px-1 font-normal not-italic tracking-normal text-[#1f1f1f]">Google Maps</span>.</p>}
    <p aria-live="polite" className="text-sm">{origin ? `Starting point: ${origin.label}.${origin.accuracy !== undefined ? ` Device accuracy: about ${Math.ceil(origin.accuracy)} m; similarly close offices may change order.` : ""}` : "No starting point selected. Offices are shown without distance ranking."}</p>
  </section>
}

export function OfficeResults({ offices, origin, showMap }: { offices: readonly EligibleOffice[]; origin?: SearchOrigin; showMap: boolean }) {
  const ranked = rankOffices(offices, origin?.point)
  const [selectedId, setSelectedId] = useState("")
  const selected = ranked.find((entry) => entry.office.id === selectedId) ?? ranked[0]
  const missing = ranked.filter((entry) => entry.office.mode !== "online" && !entry.point).length
  return <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,1fr)]">
    <div className="min-w-0">
      {showMap && (origin || selected?.point) ? <OfficeMap origin={origin} office={selected?.point ? { point: selected.point, name: selected.office.name } : undefined} /> : <div className="flex min-h-48 flex-col justify-center gap-2 rounded-xl border bg-background p-5 text-sm text-muted-foreground"><MapPin className="size-5" aria-hidden /><p>{showMap ? "No verified office location or confirmed starting point is available to map." : "The map appears here after you choose to load Google Maps."}</p><p>Office addresses and selection remain available in the list.</p></div>}
    </div>
    <section aria-label="Eligible offices" className="min-w-0 rounded-xl border bg-background">
      <div className="border-b p-4 text-sm" aria-live="polite"><h3 className="font-semibold">Eligible offices · {ranked.length}</h3><p className="mt-1 text-muted-foreground">{origin ? "Mapped offices are ordered by approximate straight-line distance, not driving distance or travel time." : "Choose a starting point to compare distances."}</p>{missing > 0 && <p className="mt-2">Partial location coverage: {missing} eligible office(s) need coordinate verification and are unranked.</p>}</div>
      <ul className="divide-y lg:max-h-[36rem] lg:overflow-y-auto lg:overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
        {ranked.map((entry) => <li key={entry.office.id} className="p-4">
          <button type="button" onClick={() => setSelectedId(entry.office.id)} aria-pressed={selected?.office.id === entry.office.id} className="flex min-h-11 w-full flex-col gap-1 rounded-lg p-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground">
            <span className="font-semibold">{entry.office.name}</span>
            <span className="text-sm">{selected?.office.id === entry.office.id ? "Selected · " : ""}{entry.office.mode === "online" ? "Online service" : entry.office.address || "Address needs verification"}</span>
            {entry.km !== undefined && <span className="text-sm">{distanceLabel(entry.km)}</span>}
            {entry.office.mode !== "online" && !entry.point && <span className="text-sm">Map coordinates need verification · no pin or distance</span>}
          </button>
          {!entry.office.id.startsWith("demo-") && <>
            <p className="mt-3 text-xs text-muted-foreground">Official-source service and area coverage. Office ID: {entry.office.id}. Capability checked {entry.evidence.checkedOn}; coverage checked {entry.coverageEvidence.checkedOn}. Confirm counter hours and address with the agency before visiting.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {entry.point && <a href={directionsUrl(entry.point)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}><Navigation aria-hidden />Directions in Google Maps</a>}
              {!entry.point && entry.office.mode !== "online" && entry.office.address && <a href={mapsSearchUrl(`${entry.office.name}, ${entry.office.address}`)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>Search address on Google Maps (unverified)</a>}
              <a href={entry.office.website} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "ghost" })}>Official site <ExternalLink aria-hidden /></a>
              {entry.office.addressEvidence && <a href={entry.office.addressEvidence.sourceUrl} target="_blank" rel="noreferrer" className="min-h-11 py-3 text-xs text-primary underline underline-offset-4">Address source</a>}
              <a href={entry.evidence.sourceUrl} target="_blank" rel="noreferrer" className="min-h-11 py-3 text-xs text-primary underline underline-offset-4">Service evidence</a>
              <a href={entry.coverageEvidence.sourceUrl} target="_blank" rel="noreferrer" className="min-h-11 py-3 text-xs text-primary underline underline-offset-4">Coverage evidence</a>
            </div>
            <ReportRedTape office={entry.office.name} />
          </>}
        </li>)}
      </ul>
    </section>
  </div>
}

function ReportRedTape({ office }: { office: string }) {
  const inputId = useId()
  const [message, setMessage] = useState("")
  const [result, setResult] = useState<string>()
  const [pending, start] = useTransition()
  return <details className="text-xs">
    <summary className="cursor-pointer py-2 text-muted-foreground">Report a problem through eReport</summary>
    <form className="mt-2 flex flex-col gap-2" onSubmit={(event) => {
      event.preventDefault()
      start(async () => {
        try {
          const response = await reportProblem({ office, message })
          setResult(response.ok ? `Filed. Case number ${response.caseNumber}` : response.error)
          if (response.ok) setMessage("")
        } catch { setResult("The report could not be sent. Try again.") }
      })
    }}>
      <label className="sr-only" htmlFor={inputId}>Describe the problem</label>
      <textarea id={inputId} value={message} onChange={(event) => setMessage(event.target.value)} className="h-20 rounded-lg border bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring" placeholder="What happened?" />
      <Button type="submit" size="sm" disabled={pending || !message.trim()} className="self-start">Submit report</Button>
      {result && <p role="status">{result}</p>}
    </form>
  </details>
}
