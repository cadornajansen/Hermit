// Agency connectors for Kuya Hermit: SSS, PhilHealth, Pag-IBIG records,
// appointment slots and paid services (NBI clearance).
// ponytail: DEMO ONLY. HERMIT has no access to these agencies yet, so every
// record and slot here is generated sample data, deterministic per owner, and
// always marked demo: true for the UI to label. Swap agencyRecord /
// appointmentSlots for real adapters (lib/egov style) when APIs exist.

export type Agency = "sss" | "philhealth" | "pagibig"

type Profileish = { ownerName: string; businessName: string; employees: string; structure: string }

export type AgencyRecord = {
  demo: true
  agency: Agency
  name: string // agency display name
  number: string
  status: string
  summary: string
  rows: { label: string; value: string; note?: string }[]
  total?: { label: string; value: string }
}

export type Slot = { at: string; office: string } // at = local ISO "YYYY-MM-DDTHH:MM"

export type Appointment = { id: string; office: string; at: string; purpose: string; demo: true }

export const SERVICES = {
  nbi_clearance: {
    name: "NBI Clearance",
    agency: "National Bureau of Investigation",
    fee: 130,
    eFee: 25,
    checks: ["PhilSys identity (eVerify)", "Purpose of clearance", "Biometrics capture at an NBI branch if none on file"],
  },
} as const
export type ServiceId = keyof typeof SERVICES

// Small seeded PRNG (FNV-1a → mulberry32) so an owner sees the same sample data every time.
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
const digits = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 10)).join("")
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
const monthName = (d: Date) => d.toLocaleDateString("en-PH", { month: "long", year: "numeric" })

export function agencyRecord(agency: Agency, p: Profileish, today = new Date()): AgencyRecord {
  const r = rng(`${agency}:${p.ownerName || p.businessName || "owner"}`)
  const employer = p.employees !== "none" && p.employees !== "unknown"
  const months = [1, 2, 3].map((i) => new Date(today.getFullYear(), today.getMonth() - i, 1))
  const posted = Math.floor(r() * 60) + 24

  if (agency === "sss") {
    const amount = [1350, 1530, 1710, 1830][Math.floor(r() * 4)]
    return {
      demo: true,
      agency,
      name: "SSS",
      number: `${digits(r, 2)}-${digits(r, 7)}-${digits(r, 1)}`,
      status: "Active",
      summary: `${employer ? "Employer" : "Self-employed"} contributions posted through ${monthName(months[0])}`,
      rows: months.map((m) => ({ label: monthName(m), value: peso(amount), note: "Posted" })),
      total: { label: `${posted} contributions posted`, value: peso(amount * posted) },
    }
  }
  if (agency === "philhealth") {
    const dependents = Math.floor(r() * 4)
    return {
      demo: true,
      agency,
      name: "PhilHealth",
      number: `${digits(r, 2)}-${digits(r, 9)}-${digits(r, 1)}`,
      status: "Active",
      summary: `Premiums up to date through ${monthName(months[0])}`,
      rows: [
        { label: "Membership", value: p.structure === "corporation" ? "Employer" : "Direct contributor · Self-earning" },
        { label: "Premiums paid until", value: monthName(months[0]) },
        { label: "Registered dependents", value: String(dependents) },
      ],
    }
  }
  const monthly = 200
  return {
    demo: true,
    agency,
    name: "Pag-IBIG Fund",
    number: `${digits(r, 4)}-${digits(r, 4)}-${digits(r, 4)}`,
    status: "Active",
    summary: `${posted} monthly savings posted`,
    rows: months.map((m) => ({ label: monthName(m), value: peso(monthly), note: "Posted" })),
    total: { label: "Total savings", value: peso(monthly * posted) },
  }
}

const pad = (n: number) => String(n).padStart(2, "0")
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Three open weekday slots in the next two weeks, never on a day the owner
// already has an appointment.
export function appointmentSlots(office: string, booked: { at: string }[], today = new Date()): Slot[] {
  const r = rng(`slots:${office}:${localDay(today)}`)
  const busy = new Set(booked.map((b) => b.at.slice(0, 10)))
  const out: Slot[] = []
  for (let i = 1; i <= 14 && out.length < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    if (d.getDay() === 0 || d.getDay() === 6 || busy.has(localDay(d)) || r() < 0.35) continue
    const hour = [8, 9, 10, 13, 14, 15][Math.floor(r() * 6)]
    out.push({ at: `${localDay(d)}T${pad(hour)}:${r() < 0.5 ? "00" : "30"}`, office })
  }
  return out
}
