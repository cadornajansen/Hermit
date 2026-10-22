import type { OfficeType } from "./types"

// How to find each kind of office on Google Maps, and how to tell a real
// match from a nearby shop with a similar name.
type Search = { label: string; query: (city: string, barangay: string) => string; match: RegExp; jurisdiction?: string }

export const OFFICE_SEARCH: Partial<Record<OfficeType, Search>> = {
  barangay: {
    label: "Barangay hall",
    query: (city, brgy) => (brgy ? `Barangay ${brgy} hall ${city}` : `barangay hall ${city}`),
    match: /barangay|brgy/i,
    jurisdiction: "Ang barangay ng negosyo mo ang may hawak, hindi ang pinakamalapit.",
  },
  bplo: {
    label: "City / municipal hall (BPLO)",
    query: (city) => `${city} city hall business permits and licensing office`,
    match: /city hall|municipal hall|business permit|bplo|e-?boss|munisipyo/i,
    jurisdiction: "Ang city hall ng lungsod kung nasaan ang negosyo mo ang may hawak.",
  },
  bir_rdo: {
    label: "BIR Revenue District Office",
    query: (city) => `BIR Revenue District Office ${city}`,
    match: /\bbir\b|bureau of internal revenue|revenue district|\brdo\b/i,
    jurisdiction: "Ang RDO mo ay batay sa address ng negosyo — tingnan sa COR o sa ORUS.",
  },
  bfp: { label: "Bureau of Fire Protection", query: (city) => `BFP fire station ${city}`, match: /fire|\bbfp\b/i },
  health: { label: "City health office", query: (city) => `${city} city health office`, match: /health/i },
  cenro: { label: "City environment office (CENRO)", query: (city) => `${city} environment and natural resources office`, match: /environment|enro|cenro/i },
  negosyo_center: { label: "DTI Negosyo Center", query: (city) => `DTI Negosyo Center ${city}`, match: /negosyo|\bdti\b|trade and industry/i },
  sss: { label: "SSS branch", query: (city) => `SSS branch ${city}`, match: /\bsss\b|social security/i },
  philhealth: { label: "PhilHealth office", query: (city) => `PhilHealth office ${city}`, match: /philhealth/i },
  pagibig: { label: "Pag-IBIG Fund branch", query: (city) => `Pag-IBIG Fund branch ${city}`, match: /pag-?ibig|hdmf/i },
  dole: { label: "DOLE field office", query: (city) => `DOLE field office ${city}`, match: /\bdole\b|labor and employment/i },
  fda: { label: "FDA office", query: () => `Food and Drug Administration Philippines office`, match: /\bfda\b|food and drug/i },
}

export type NearbyOffice = {
  type: OfficeType
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  km: number
  mapsUrl: string
}

// Great-circle distance in km.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ~110 m precision: enough to find nearby offices, less than an exact home location.
export const roughly = (v: number) => Math.round(v * 1000) / 1000

export const directionsUrl = (o: Pick<NearbyOffice, "name" | "placeId" | "lat" | "lng">) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.name)}&destination_place_id=${encodeURIComponent(o.placeId)}`
