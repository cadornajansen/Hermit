import { validPoint } from "./office-finder.ts"
import type { Point } from "./nearby.ts"

export type GeocodeCandidate = { id: string; label: string; point: Point; approximate: boolean }
export type GeocodeResult =
  | { ok: true; candidates: GeocodeCandidate[]; partial: boolean }
  | { ok: false; error: "disabled" | "no_key" | "invalid" | "quota" | "unavailable"; retryAfterSeconds?: number }

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {}

export function parseGeocodeResponse(value: unknown): GeocodeResult {
  const json = object(value)
  if (json.status === "OVER_QUERY_LIMIT" || json.status === "OVER_DAILY_LIMIT") return { ok: false, error: "quota", retryAfterSeconds: 60 }
  if (json.status === "ZERO_RESULTS") return { ok: true, candidates: [], partial: false }
  if (json.status !== "OK" || !Array.isArray(json.results) || !json.results.length) return { ok: false, error: "unavailable" }
  const candidates: GeocodeCandidate[] = []
  for (const [index, raw] of json.results.slice(0, 5).entries()) {
    const entry = object(raw)
    const geometry = object(entry.geometry)
    const loc = object(geometry.location)
    const point = { lat: loc.lat as number, lng: loc.lng as number }
    const country = Array.isArray(entry.address_components) && entry.address_components.some((raw) => {
      const part = object(raw)
      return part.short_name === "PH" && Array.isArray(part.types) && part.types.includes("country")
    })
    if (!country || !validPoint(point) || typeof entry.formatted_address !== "string" || !entry.formatted_address.trim()) continue
    candidates.push({ id: String(index), label: entry.formatted_address.slice(0, 500), point,
      approximate: entry.partial_match === true || geometry.location_type !== "ROOFTOP" })
  }
  return candidates.length ? { ok: true, candidates, partial: candidates.length !== json.results.length } : { ok: false, error: "unavailable" }
}
