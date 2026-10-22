"use server"

import { takeAiQuota } from "@/lib/ratelimit"
import { distanceKm, OFFICE_SEARCH, roughly, type NearbyOffice } from "@/lib/nearby"
import type { OfficeType } from "@/lib/types"

// Google Maps Platform, server side: Geocoding + Places API (New) Text Search.
// The key stays on the server; restrict it to those two APIs in Cloud Console.
const KEY = () => process.env.GOOGLE_MAPS_SERVER_KEY
// Pro-tier fields only (opening hours and phone numbers are Enterprise-priced).
const FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.businessStatus"
const RADIUS_M = 20_000

type Place = {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  googleMapsUri?: string
  businessStatus?: string
}

// ponytail: per-instance memory cache; move to Supabase if Places costs climb.
const cache = new Map<string, { at: number; offices: NearbyOffice[] }>()
const DAY = 86_400_000

export async function mapsEnabled() {
  return Boolean(KEY())
}

async function geocode(address: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.search = new URLSearchParams({ address, region: "ph", components: "country:PH", key: KEY()! }).toString()
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const j = await r.json()
  const loc = j.results?.[0]?.geometry?.location
  return loc ? { lat: loc.lat as number, lng: loc.lng as number } : null
}

async function search(text: string, at: { lat: number; lng: number }) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": KEY()!, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({
      textQuery: text,
      locationBias: { circle: { center: { latitude: at.lat, longitude: at.lng }, radius: RADIUS_M } },
      pageSize: 8,
      languageCode: "en",
      regionCode: "PH",
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new Error(`Places ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return ((await r.json()).places ?? []) as Place[]
}

export async function findNearbyOffices(input: {
  lat?: number
  lng?: number
  address?: string
  city: string
  barangay: string
  types: OfficeType[]
}) {
  if (!KEY()) return { ok: false as const, error: "no_key" }
  const types = (Array.isArray(input?.types) ? input.types : []).filter((t) => t in OFFICE_SEARCH).slice(0, 14)
  const city = String(input?.city ?? "").slice(0, 60)
  const barangay = String(input?.barangay ?? "").slice(0, 60)

  let at: { lat: number; lng: number } | null = null
  const { lat, lng } = input ?? {}
  if (typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) at = { lat: roughly(lat), lng: roughly(lng) }

  const key = `${at ? `${at.lat},${at.lng}` : String(input?.address ?? "").slice(0, 200)}|${city}|${barangay}|${types.join(",")}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < DAY) return { ok: true as const, center: at ?? null, offices: hit.offices }

  if (!(await takeAiQuota("maps"))) return { ok: false as const, error: "Masyadong maraming hanap ngayon. Subukan ulit mamaya." }
  try {
    if (!at) {
      const address = String(input?.address ?? "").slice(0, 200)
      if (!address) return { ok: false as const, error: "Walang address o lokasyon." }
      at = await geocode(address)
      if (!at) return { ok: false as const, error: "Hindi mahanap ang address sa mapa. Gamitin ang lokasyon mo." }
    }
    const center = at
    const found = await Promise.all(
      types.map(async (type) => {
        const s = OFFICE_SEARCH[type]!
        const places = await search(s.query(city, barangay), center).catch((e) => {
          console.error("Places search failed", type, e)
          return [] as Place[]
        })
        return places
          .filter((p) => p.location && p.displayName && s.match.test(p.displayName.text) && p.businessStatus !== "CLOSED_PERMANENTLY")
          .map((p): NearbyOffice => {
            const loc = { lat: p.location!.latitude, lng: p.location!.longitude }
            return {
              type,
              placeId: p.id,
              name: p.displayName!.text,
              address: p.formattedAddress ?? "",
              ...loc,
              km: Math.round(distanceKm(center, loc) * 10) / 10,
              mapsUrl: p.googleMapsUri ?? "",
            }
          })
          .sort((a, b) => a.km - b.km)
          .slice(0, 3)
      })
    )
    const offices = found.flat()
    cache.set(key, { at: Date.now(), offices })
    return { ok: true as const, center, offices }
  } catch (e) {
    console.error("Nearby office search failed", e)
    return { ok: false as const, error: "Hindi ma-reach ang Google Maps ngayon. Subukan ulit." }
  }
}
