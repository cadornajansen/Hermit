"use server"

import { parseGeocodeResponse, type GeocodeResult } from "@/lib/google-geocoding"
import { takeGoogleGeocodeQuota } from "@/lib/ratelimit"

export async function geocodeOrigin(input: unknown): Promise<GeocodeResult> {
  if (process.env.OFFICE_FINDER_ENABLED !== "true") return { ok: false, error: "disabled" }
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key) return { ok: false, error: "no_key" }
  if (typeof input !== "string" || input.trim().length < 3 || input.length > 300 || /[\u0000-\u001f]/.test(input)) return { ok: false, error: "invalid" }
  try {
    const quota = await takeGoogleGeocodeQuota()
    if (!quota.ok) return { ok: false, error: quota.error, retryAfterSeconds: 60 }
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
    url.search = new URLSearchParams({ address: input.trim(), components: "country:PH", region: "ph", key }).toString()
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
    if (response.status === 429) return { ok: false, error: "quota", retryAfterSeconds: 60 }
    if (!response.ok) return { ok: false, error: "unavailable" }
    return parseGeocodeResponse(await response.json())
  } catch {
    // Never log the URL, provider response, address, key, or origin.
    return { ok: false, error: "unavailable" }
  }
}
