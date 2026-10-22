import type { Profile } from "./types"

// Form library: each form is a field map (form field → profile path).
// Fields with no source are asked for once, then remembered in profile.extra.
// ponytail: labels only — align item numbers against the current official PDFs
// and add a PDF filler (pdf-lib over the scraped template) when they're versioned.

type Source = (p: Profile) => string

export type FormField = { key: string; label: string; source?: Source }

export type FormTemplate = {
  id: string
  name: string
  short: string // button label
  agency: string
  portal: string
  fields: FormField[]
}

const ASSETS: Record<string, string> = {
  under_3m: "Under ₱3M",
  "3m_15m": "₱3M – ₱15M",
  "15m_100m": "₱15M – ₱100M",
}
const EMPLOYEES: Record<string, string> = {
  none: "0",
  "1_9": "1 – 9",
  "10_99": "10 – 99",
  "100_plus": "100+",
}

const known = (v: string) => (v === "unknown" ? "" : v)
const address = (p: Profile) =>
  [p.businessAddress, p.barangay && `Brgy. ${p.barangay}`, p.city].filter(Boolean).join(", ")

export const FORMS: FormTemplate[] = [
  {
    id: "bir_1901",
    name: "BIR Form 1901 — Application for Registration (individuals)",
    short: "BIR 1901",
    agency: "BIR",
    portal: "https://orus.bir.gov.ph",
    fields: [
      { key: "taxpayer_name", label: "Taxpayer name", source: (p) => p.ownerName },
      { key: "birth_date", label: "Date of birth", source: (p) => p.birthDate },
      { key: "residence", label: "Residence address", source: (p) => p.homeAddress },
      { key: "mobile", label: "Contact number", source: (p) => p.mobile },
      { key: "email", label: "Email address", source: (p) => p.email },
      { key: "trade_name", label: "Trade / business name", source: (p) => p.businessName },
      { key: "business_address", label: "Business address", source: address },
      { key: "line_of_business", label: "Line of business / PSIC", source: (p) => p.psic },
      { key: "tin", label: "TIN (if you already have one)" },
      { key: "dti_no", label: "DTI business name certificate no." },
      {
        key: "tax_option",
        label: "Income tax option",
        source: (p) => ({ "8pct": "8% flat rate", graduated: "Graduated rates" })[p.taxOption as string] ?? "",
      },
    ],
  },
  {
    id: "bmbe",
    name: "BMBE Application Form",
    short: "BMBE form",
    agency: "DTI Negosyo Center",
    portal: "https://www.dti.gov.ph",
    fields: [
      { key: "business_name", label: "Business name", source: (p) => p.businessName },
      { key: "owner_name", label: "Owner's name", source: (p) => p.ownerName },
      { key: "business_address", label: "Business address", source: address },
      { key: "activity", label: "Business activity", source: (p) => p.description },
      { key: "total_assets", label: "Total assets (excluding land)", source: (p) => ASSETS[p.assets] ?? "" },
      { key: "employees", label: "Number of employees", source: (p) => EMPLOYEES[p.employees] ?? "" },
      { key: "dti_no", label: "DTI / SEC / CDA registration no." },
      { key: "tin", label: "TIN" },
    ],
  },
  {
    id: "lgu_permit",
    name: "Unified Business Permit Application (pilot city)",
    short: "business permit form",
    agency: "City BPLO",
    portal: "https://www.taguig.gov.ph",
    fields: [
      { key: "business_name", label: "Business / trade name", source: (p) => p.businessName },
      { key: "owner_name", label: "Owner / president", source: (p) => p.ownerName },
      { key: "business_address", label: "Business address", source: address },
      { key: "barangay", label: "Barangay", source: (p) => p.barangay },
      { key: "ownership", label: "Type of organization", source: (p) => known(p.structure) },
      { key: "premises", label: "Place of business is", source: (p) => known(p.premises) },
      { key: "employees", label: "Number of employees", source: (p) => EMPLOYEES[p.employees] ?? "" },
      { key: "dti_no", label: "DTI / SEC / CDA registration no." },
      { key: "tin", label: "TIN" },
      { key: "floor_area", label: "Business area (sq m)" },
      { key: "capital", label: "Capitalization (new) / gross sales (renewal)" },
    ],
  },
]

export const getForm = (id: string) => FORMS.find((f) => f.id === id)

// Profile first, then values the owner already typed for another form.
export function fillForm(form: FormTemplate, p: Profile) {
  return form.fields.map((f) => {
    const value = f.source?.(p) || p.extra[f.key] || ""
    return { ...f, value, missing: !value }
  })
}
