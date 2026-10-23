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
const cache = new Map<string, { at: number; center: { lat: number; lng: number }; offices: NearbyOffice[] }>()
const DAY = 86_400_000

export async function mapsEnabled() {
  return Boolean(KEY())
}

async function geocode(address: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.search = new URLSearchParams({ address, region: "ph", components: "country:PH", key: KEY()! }).toString()
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`Geocoding HTTP ${r.status}`)
  const j = await r.json()
  if (j.status !== "OK" && j.status !== "ZERO_RESULTS") throw new Error(`Geocoding ${j.status}`)
  const loc = j.results?.[0]?.geometry?.location
  return loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180 ? { lat: loc.lat as number, lng: loc.lng as number } : null
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
  const types = [...new Set(Array.isArray(input?.types) ? input.types : [])].filter((t) => Object.hasOwn(OFFICE_SEARCH, t)).slice(0, 14)
  if (!types.length) return { ok: false as const, error: "Choose at least one office type." }
  const city = String(input?.city ?? "").slice(0, 60)
  const barangay = String(input?.barangay ?? "").slice(0, 60)

  let at: { lat: number; lng: number } | null = null
  const { lat, lng } = input ?? {}
  if (typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) at = { lat: roughly(lat), lng: roughly(lng) }

  const key = `${at ? `${at.lat},${at.lng}` : String(input?.address ?? "").slice(0, 200)}|${city}|${barangay}|${types.join(",")}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < DAY) return { ok: true as const, center: at ?? hit.center, offices: hit.offices, failedTypes: [] as OfficeType[], cached: true }

  if (!(await takeAiQuota("maps"))) return { ok: false as const, error: "Masyadong maraming hanap ngayon. Subukan ulit mamaya." }
  try {
    if (!at) {
      const address = String(input?.address ?? "").slice(0, 200)
      if (!address) return { ok: false as const, error: "Walang address o lokasyon." }
      at = await geocode(address)
      if (!at) return { ok: false as const, error: "Hindi mahanap ang address sa mapa. Gamitin ang lokasyon mo." }
    }
    const center = at
    const failedTypes: OfficeType[] = []
    const found = await Promise.all(
      types.map(async (type) => {
        const s = OFFICE_SEARCH[type]!
        const places = await search(s.query(city, barangay), center).catch((e) => {
          console.error("Places search failed", type, e)
          failedTypes.push(type)
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
    if (failedTypes.length === types.length) return { ok: false as const, error: "Hindi ma-reach ang Google Maps ngayon. Subukan ulit." }
    // A retry must recheck failed types rather than reuse an incomplete result.
    if (!failedTypes.length) cache.set(key, { at: Date.now(), center, offices })
    return { ok: true as const, center, offices, failedTypes, cached: false }
  } catch (e) {
    console.error("Nearby office search failed", e)
    return { ok: false as const, error: "Hindi ma-reach ang Google Maps ngayon. Subukan ulit." }
  }
}
