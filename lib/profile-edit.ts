// Changes to the owner's profile that Kuya Hermit makes when asked
// ("palitan ang TIN ko"). Every value is checked here; the app applies the
// result at once and keeps the old value for Undo.
import type { Profile } from "./types"

export type ProfileChange = { field: string; label: string; from: string; to: string }

const ENUMS: Record<string, readonly string[]> = {
  category: ["retail", "food_service", "packaged_food", "other"],
  structure: ["sole", "partnership", "corporation", "cooperative"],
  stage: ["planning", "operating_unregistered", "registered"],
  premises: ["home", "rented", "owned"],
  channel: ["physical", "online", "both", "mobile"],
  assets: ["under_3m", "3m_15m", "15m_100m"],
  sales: ["under_500k", "500k_3m", "over_3m"],
  taxOption: ["8pct", "graduated"],
  employees: ["none", "1_9", "10_99", "100_plus"],
  lang: ["fil", "en"],
}

const text = (max: number) => (v: string) => (v.length >= 2 && v.length <= max ? v : null)

// field → [label, validator returning the stored value or null]
export const EDITABLE: Record<string, [string, (v: string) => string | null]> = {
  ownerName: ["Owner name", text(120)],
  birthDate: ["Birth date", (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && Date.parse(v) < Date.now() && Date.parse(v) > Date.parse("1900-01-01") ? v : null)],
  homeAddress: ["Home address", text(200)],
  mobile: [
    "Mobile number",
    (v) => {
      const d = v.replace(/\D/g, "").replace(/^0?(?=9\d{9}$)/, "63")
      return /^639\d{9}$/.test(d) ? `+${d}` : null
    },
  ],
  email: ["Email", (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 120 ? v.toLowerCase() : null)],
  businessName: ["Business name", text(120)],
  description: ["What the business does", text(200)],
  businessAddress: ["Business address", text(200)],
  barangay: ["Barangay", text(80)],
  city: ["City / municipality", text(80)],
  tin: [
    "TIN",
    (v) => {
      const d = v.replace(/\D/g, "")
      return d.length >= 9 && d.length <= 14 ? (d.match(/.{1,3}/g) ?? []).join("-") : null
    },
  ],
  rdoCode: ["RDO code", (v) => (/^\d{3}[A-Za-z]?$/.test(v) ? v.toUpperCase() : null)],
  dtiNo: ["DTI / SEC / CDA registration no.", (v) => (/^[A-Za-z0-9-]{4,30}$/.test(v) ? v.toUpperCase() : null)],
  ...Object.fromEntries(Object.entries(ENUMS).map(([k, list]) => [k, [k, (v: string) => (list.includes(v) ? v : null)]])),
}
export const ENUM_VALUES = ENUMS

export function applyProfileChanges(p: Profile, changes: Record<string, unknown>) {
  const next = { ...p } as Record<string, unknown>
  const applied: ProfileChange[] = []
  const rejected: { field: string; reason: string }[] = []
  for (const [field, raw] of Object.entries(changes ?? {})) {
    const rule = EDITABLE[field]
    if (!rule) {
      rejected.push({ field, reason: "not editable" })
      continue
    }
    const value = typeof raw === "string" ? rule[1](raw.trim()) : null
    if (value === null) {
      rejected.push({ field, reason: ENUMS[field] ? `must be one of ${ENUMS[field].join(", ")}` : "invalid value" })
      continue
    }
    const from = String(next[field] ?? "")
    if (from === value) continue
    next[field] = value
    applied.push({ field, label: rule[0], from, to: value })
  }
  // A verified identity no longer matches once its name or birth date changes.
  if (p.identityVerified && applied.some((c) => c.field === "ownerName" || c.field === "birthDate")) {
    next.identityVerified = false
    applied.push({ field: "identityVerified", label: "National ID check", from: "true", to: "false" })
  }
  // The old city's province / region context no longer applies.
  if (applied.some((c) => c.field === "city")) {
    for (const k of ["province", "region"] as const)
      if (next[k]) {
        applied.push({ field: k, label: k, from: String(next[k]), to: "" })
        next[k] = undefined
      }
  }
  return { profile: next as Profile, applied, rejected }
}

// Puts changes on (redo) or takes them off (undo) a profile.
export function setChanges(p: Profile, changes: ProfileChange[], dir: "to" | "from"): Profile {
  const next = { ...p } as Record<string, unknown>
  for (const c of changes) next[c.field] = c.field === "identityVerified" ? c[dir] === "true" : c[dir] || (c.field === "province" || c.field === "region" ? undefined : "")
  return next as Profile
}
