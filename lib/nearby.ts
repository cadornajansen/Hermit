import type { Profile } from "./types"

export type Point = { lat: number; lng: number }

export function businessSearchAddress(p: Pick<Profile, "businessAddress" | "barangay" | "city" | "province" | "region">) {
  const parts: string[] = []
  const normalized = (value: string) => value.toLowerCase().replace(/\bbrgy\.?/g, "barangay").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  for (const part of [p.businessAddress, p.barangay && `Barangay ${p.barangay}`, p.city, p.province, p.region, "Philippines"]) {
    if (part && !` ${normalized(parts.join(" "))} `.includes(` ${normalized(part)} `)) parts.push(part)
  }
  return parts.join(", ")
}

// Great-circle distance in km; it does not measure roads or travel time.
export function distanceKm(a: Point, b: Point) {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

// Share only a verified destination; the external service requests its own origin.
export const directionsUrl = (point: Point) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${point.lat},${point.lng}`)}`
