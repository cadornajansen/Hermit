"use client"

import { useEffect, useRef } from "react"

import { directionsUrl, OFFICE_SEARCH, type NearbyOffice } from "@/lib/nearby"
import type { OfficeType } from "@/lib/types"

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
// A Map ID enables Advanced Markers; DEMO_MAP_ID works until one is created.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"

export const COLORS: Partial<Record<OfficeType, string>> = {
  barangay: "#0f766e",
  bplo: "#1d4ed8",
  bir_rdo: "#b91c1c",
  bfp: "#ea580c",
  health: "#15803d",
  cenro: "#4d7c0f",
  negosyo_center: "#7c3aed",
  sss: "#0369a1",
  philhealth: "#16a34a",
  pagibig: "#c2410c",
  dole: "#475569",
  fda: "#be185d",
}

let loader: Promise<void> | null = null
function loadMaps() {
  if (loader) return loader
  loader = new Promise<void>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>
    w.__hermitMapsReady = () => resolve()
    const s = Object.assign(document.createElement("script"), {
      src: `https://maps.googleapis.com/maps/api/js?key=${KEY}&v=weekly&loading=async&callback=__hermitMapsReady`,
      async: true,
    })
    s.onerror = () => {
      loader = null
      reject(new Error("Google Maps failed to load"))
    }
    document.head.appendChild(s)
  })
  return loader
}

export const mapsOnPage = Boolean(KEY)

export function OfficeMap({
  center,
  offices,
  selected,
  onSelect,
}: {
  center: { lat: number; lng: number }
  offices: NearbyOffice[]
  selected?: string
  onSelect: (placeId: string) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const markers = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map())
  const info = useRef<google.maps.InfoWindow | null>(null)

  useEffect(() => {
    if (!KEY || !el.current) return
    let cancelled = false
    ;(async () => {
      await loadMaps()
      const [{ Map: GMap, InfoWindow }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
        google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
        google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
      ])
      if (cancelled || !el.current) return
      map.current ??= new GMap(el.current, { center, zoom: 13, mapId: MAP_ID, clickableIcons: false, gestureHandling: "greedy" })
      info.current ??= new InfoWindow()
      for (const m of markers.current.values()) m.map = null
      markers.current.clear()

      const you = new PinElement({ background: "#111827", borderColor: "#ffffff", glyphColor: "#ffffff", glyphText: "•" })
      new AdvancedMarkerElement({ map: map.current, position: center, title: "Ikaw · You", content: you.element, zIndex: 1000 })

      const bounds = new google.maps.LatLngBounds(center)
      for (const o of offices) {
        const pin = new PinElement({
          background: COLORS[o.type] ?? "#334155",
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          glyphText: OFFICE_SEARCH[o.type]?.label.charAt(0) ?? "•",
        })
        const m = new AdvancedMarkerElement({ map: map.current, position: { lat: o.lat, lng: o.lng }, title: o.name, content: pin.element, gmpClickable: true })
        m.addListener("click", () => onSelect(o.placeId))
        markers.current.set(o.placeId, m)
        bounds.extend({ lat: o.lat, lng: o.lng })
      }
      if (offices.length) map.current.fitBounds(bounds, 48)
      else map.current.setCenter(center)
    })().catch((e) => console.error(e))
    return () => {
      cancelled = true
    }
    // onSelect is stable enough for markers; re-run only when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, offices])

  // Show the selected office's card on the map.
  useEffect(() => {
    const o = offices.find((x) => x.placeId === selected)
    const m = selected ? markers.current.get(selected) : undefined
    if (!o || !m || !info.current || !map.current) return
    const box = document.createElement("div")
    box.style.cssText = "font: 13px system-ui; color: #111; max-width: 220px"
    const title = Object.assign(document.createElement("strong"), { textContent: o.name })
    const addr = Object.assign(document.createElement("div"), { textContent: `${o.address} · ${o.km} km` })
    const link = Object.assign(document.createElement("a"), { href: directionsUrl(o), target: "_blank", rel: "noreferrer", textContent: "Directions →" })
    link.style.color = "#1d4ed8"
    box.append(title, addr, link)
    info.current.setContent(box)
    info.current.open({ map: map.current, anchor: m })
  }, [selected, offices])

  if (!KEY) return null
  return <div ref={el} className="h-80 w-full overflow-hidden rounded-2xl border bg-muted" role="region" aria-label="Map of nearby offices" />
}
