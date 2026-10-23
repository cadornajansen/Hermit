// Nearest government branches for Kuya Hermit's map card.
// ponytail: DEMO ONLY. Branch names and pins are generated sample sites around
// the owner's city (stable per city + agency), labelled "sample" in the UI.
// Swap nearestBranches for a real branch directory or Places search later.

export const BRANCH_AGENCIES = {
  sss: "SSS",
  philhealth: "PhilHealth",
  pagibig: "Pag-IBIG Fund",
  bir: "BIR RDO",
  dti: "DTI Negosyo Center",
  nbi: "NBI Clearance Center",
  dfa: "DFA Passport Office",
  psa: "PSA Serbilis Center",
  lto: "LTO District Office",
} as const
export type BranchAgency = keyof typeof BRANCH_AGENCIES

export type Branch = { id: string; agency: BranchAgency; name: string; address: string; lat: number; lng: number; km: number }

// City halls of Metro Manila (approximate), the owner's starting point.
const CENTERS: Record<string, [number, number]> = {
  taguig: [14.5176, 121.0509],
  makati: [14.5547, 121.0244],
  pasig: [14.5764, 121.0851],
  mandaluyong: [14.5794, 121.0359],
  manila: [14.5995, 120.9842],
  "quezon city": [14.676, 121.0437],
  pasay: [14.5378, 121.0014],
  paranaque: [14.4793, 121.0198],
  "las pinas": [14.4445, 120.9939],
  muntinlupa: [14.4081, 121.0415],
  marikina: [14.6507, 121.1029],
  "san juan": [14.6019, 121.0355],
  caloocan: [14.6507, 120.9668],
  valenzuela: [14.7011, 120.983],
  malabon: [14.6681, 120.9567],
  navotas: [14.6667, 120.9417],
  pateros: [14.5454, 121.0687],
}

const key = (city: string) =>
  city.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\bcity of\b|\bcity\b/g, "").replace(/\s+/g, " ").trim()

export function cityCenter(city: string) {
  const k = key(city)
  const hit = CENTERS[k] ?? CENTERS[`${k} city`] ?? (k === "quezon" ? CENTERS["quezon city"] : undefined)
  return { lat: (hit ?? CENTERS.taguig)[0], lng: (hit ?? CENTERS.taguig)[1], approximate: !hit }
}

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Rough water mask for Metro Manila: Manila Bay to the west, Laguna de Bay to
// the south-east. Good enough to keep sample pins on land.
const inWater = (lat: number, lng: number) =>
  lng < 120.975 || (lat < 14.535 && lng > 121.062) || (lat < 14.47 && lng > 121.045) || (lat < 14.5 && lng < 120.99)

const STREETS = ["Rizal Ave.", "Mabini St.", "Bonifacio Ave.", "Luna St.", "Del Pilar St.", "Aguinaldo Hwy.", "Quezon Blvd.", "Burgos St."]

// Five sample branches within ~1–7 km of the owner's city, nearest first.
export function nearestBranches(agency: BranchAgency, city: string, n = 5): Branch[] {
  const c = cityCenter(city)
  const place = city.trim() || "Taguig"
  const r = rng(`${agency}:${key(place)}`)
  return Array.from({ length: n }, (_, i) => {
    let lat = c.lat
    let lng = c.lng
    for (let tries = 0; tries < 30; tries++) {
      const dist = 0.8 + r() * 6
      const angle = r() * 2 * Math.PI
      lat = c.lat + (dist / 111) * Math.cos(angle)
      lng = c.lng + (dist / (111 * Math.cos((c.lat * Math.PI) / 180))) * Math.sin(angle)
      if (!inWater(lat, lng)) break
    }
    const p = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 }
    return {
      id: `${agency}-${key(place)}-${i}`,
      agency,
      name: `${BRANCH_AGENCIES[agency]} ${place} ${"ABCDEFGH"[i]}`,
      address: `${Math.floor(r() * 900) + 100} ${STREETS[Math.floor(r() * STREETS.length)]}, ${place}`,
      ...p,
      km: Math.round(km(c, p) * 10) / 10,
    }
  }).sort((a, b) => a.km - b.km)
}
