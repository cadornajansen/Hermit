"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
import type { Point } from "@/lib/nearby"

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"

function detachMarkers(markers: google.maps.marker.AdvancedMarkerElement[]) {
  for (const marker of markers) marker.map = null
}

export function OfficeMap({ origin, office }: {
  origin?: { point: Point; label: string }
  office?: { point: Point; name: string }
}) {
  const element = useRef<HTMLDivElement>(null)
  const initialCenter = useRef(origin?.point ?? office?.point)
  const map = useRef<google.maps.Map | null>(null)
  const markers = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const [attempt, setAttempt] = useState(0)
  const [ready, setReady] = useState(false)
  const [tilesReady, setTilesReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!KEY || !element.current) return
    let cancelled = false
    let authFailure: (() => void) | undefined
    const target = window as unknown as Record<string, unknown>
    const previousAuthFailure = target.gm_authFailure
    const tileTimeout = setTimeout(() => { if (!cancelled) setError(true) }, 15_000)
    ;(async () => {
      await loadGoogleMaps(KEY)
      const [{ Map: GoogleMap }] = await Promise.all([
        google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
        google.maps.importLibrary("marker"),
      ])
      if (cancelled || !element.current) return
      map.current = new GoogleMap(element.current, {
        center: initialCenter.current, zoom: 13, mapId: MAP_ID, clickableIcons: false, gestureHandling: "cooperative",
      })
      authFailure = () => { if (!cancelled) setError(true) }
      target.gm_authFailure = authFailure
      google.maps.event.addListenerOnce(map.current, "tilesloaded", () => {
        clearTimeout(tileTimeout)
        if (!cancelled) { setTilesReady(true); setError(false) }
      })
      setReady(true)
    })().catch(() => { if (!cancelled) setError(true) })
    return () => {
      cancelled = true
      clearTimeout(tileTimeout)
      if (authFailure && target.gm_authFailure === authFailure) target.gm_authFailure = previousAuthFailure
      detachMarkers(markers.current)
      markers.current = []
      if (map.current) google.maps.event.clearInstanceListeners(map.current)
      map.current = null
    }
  }, [attempt])

  useEffect(() => {
    if (!ready || !map.current) return
    detachMarkers(markers.current)
    markers.current = []
    const bounds = new google.maps.LatLngBounds()
    for (const entry of [origin && { point: origin.point, name: origin.label }, office]) {
      if (!entry) continue
      const marker = new google.maps.marker.AdvancedMarkerElement({ map: map.current, position: entry.point, title: entry.name })
      markers.current.push(marker)
      bounds.extend(entry.point)
    }
    if (!bounds.isEmpty()) {
      if (origin && office) map.current.fitBounds(bounds, 48)
      else { map.current.setCenter((origin?.point ?? office?.point)!); map.current.setZoom(13) }
    }
  }, [ready, origin, office])

  return (
    <section aria-label="Office proximity map" className="min-w-0 overflow-hidden rounded-xl border bg-background">
      <div className="relative">
        <div ref={element} className="h-80 w-full lg:h-[32rem]" role="region" aria-label="Google map of the starting point and selected office" />
        {KEY && !tilesReady && !error && <p role="status" className="absolute top-3 left-3 rounded-lg bg-background p-3 text-sm">Loading Google map…</p>}
      </div>
      {(!KEY || error) && (
        <div role="alert" className="flex flex-col items-start gap-3 border-t p-4 text-sm">
          <p>{KEY ? "The map could not load. Addresses, office selection, and directions remain available in the list." : "The Google map is not configured. The office list remains available."}</p>
          {KEY && <Button variant="outline" onClick={() => { setError(false); setReady(false); setTilesReady(false); setAttempt((value) => value + 1) }}>Retry map</Button>}
        </div>
      )}
      <p className="border-t p-3 text-sm text-muted-foreground">{office ? `Selected office: ${office.name}.` : "No selected office has a verified map location."} {origin ? `Starting point: ${origin.label}.` : "Choose a starting point to compare distances."}</p>
    </section>
  )
}
