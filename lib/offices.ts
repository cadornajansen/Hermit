import type { Office, OfficeType } from "./types"
import { cityKey } from "./locations.ts"

// No eGov API gives "address → office with jurisdiction" (Compass in egov.js is
// budget data), so this is HERMIT's own maintained dataset, seeded for the
// pilot city. ponytail: one city, matched by name; replace with an
// RDO-by-barangay table + LGU self-service edits (PRD §9) when Phase 2 starts.
const TAGUIG: Office[] = [
  { type: "bplo", name: "Taguig City Hall — Business Permits and Licensing Office", note: "Mayor's Permit, e-BOSS", url: "https://www.taguig.gov.ph" },
  { type: "bir_rdo", name: "BIR RDO 44 — Taguig-Pateros", note: "Your RDO for BIR registration, books and invoices", url: "https://www.bir.gov.ph" },
  { type: "bfp", name: "BFP Taguig City Fire Station", note: "FSIC (often at the e-BOSS desk)", url: "https://bfp.gov.ph" },
  { type: "health", name: "Taguig City Health Office", note: "Sanitary permit, health certificates" },
  { type: "cenro", name: "Taguig City Environment and Natural Resources Office", note: "Environmental clearance" },
  { type: "negosyo_center", name: "DTI Negosyo Center — Taguig", note: "BMBE, business name help, counseling", url: "https://www.dti.gov.ph" },
  { type: "sss", name: "SSS Taguig branch", note: "Employer registration, contributions", url: "https://www.sss.gov.ph" },
  { type: "philhealth", name: "PhilHealth Local Health Insurance Office — Taguig", note: "Employer registration", url: "https://www.philhealth.gov.ph" },
  { type: "pagibig", name: "Pag-IBIG Fund Taguig branch", note: "Employer registration", url: "https://www.pagibigfund.gov.ph" },
  { type: "dole", name: "DOLE NCR field office covering Taguig", note: "Rule 1020 registration", url: "https://ncr.dole.gov.ph" },
  { type: "fda", name: "FDA Center for Food Regulation and Research", note: "LTO and product registration (online)", url: "https://eservices.fda.gov.ph" },
  { type: "dti", name: "DTI Business Name Registration (online)", note: "BNRS", url: "https://bnrs.dti.gov.ph" },
  { type: "sec", name: "SEC / Philippine Business Hub (online)", note: "Company registration", url: "https://business.gov.ph" },
]

export const PILOT_CITY = "Taguig"
export const isPilotCity = (city: string) => cityKey(city) === cityKey(PILOT_CITY)

export function officesFor(city: string, barangay: string, types: Set<OfficeType>): Office[] {
  const brgy: Office = {
    type: "barangay",
    name: barangay ? `Barangay ${barangay} Hall` : "Your barangay hall",
    note: "Barangay business clearance",
  }
  const list = isPilotCity(city) ? TAGUIG : []
  return [brgy, ...list].filter((o) => types.has(o.type))
}

export const mapsLink = (o: Office, city: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.name} ${city}`)}`
