import type { Appointment } from "./agencies"

// "unknown" is the "Hindi ko alam" answer: the engine treats it as "possibly required".
export type Unknown = "unknown"

export type Category =
  | "retail" // sari-sari store / small retail
  | "food_service" // carinderia, restaurant, café, food cart
  | "packaged_food" // makes or repacks food to sell in stores
  | "other"

export type Flag =
  | "food"
  | "fda" // drugs, cosmetics, supplements, medical devices
  | "alcohol"
  | "fuel"
  | "security"
  | "lending"
  | "import_export"
  | "transport"
  | "construction"
  | "professional"

export type Profile = {
  // Identity (from eGovPH SSO + eVerify, or typed manually)
  ownerName: string
  birthDate: string
  homeAddress: string
  mobile: string
  email: string
  identityVerified: boolean

  businessName: string
  description: string
  category: Category | Unknown
  psic: string
  stage: "planning" | "operating_unregistered" | "registered" | Unknown
  structure: "sole" | "partnership" | "corporation" | "cooperative" | Unknown
  businessAddress: string
  barangay: string
  region?: string // Optional for profiles saved before the location dropdowns.
  province?: string // Province context distinguishes cities/municipalities with the same name.
  city: string
  premises: "home" | "rented" | "owned" | Unknown
  channel: "physical" | "online" | "both" | "mobile" | Unknown
  assets: "under_3m" | "3m_15m" | "15m_100m" | Unknown
  sales: "under_500k" | "500k_3m" | "over_3m" | Unknown
  taxOption: "8pct" | "graduated" | Unknown
  employees: "none" | "1_9" | "10_99" | "100_plus" | Unknown
  flags: Partial<Record<Flag, boolean | Unknown>>
  have: string[] // requirement ids the owner already holds
  lang: "fil" | "en"
  reminders: ("sms" | "push")[]
  // Legacy / vault metadata. Never treated as consented reusable form answers.
  extra: Record<string, string>
  // Facts the owner told Kuya Hermit to keep (Memory page); editable and deletable.
  memory?: MemoryFact[]
  // Appointments booked through Kuya Hermit (demo bookings, see lib/agencies.ts).
  appointments?: Appointment[]
}

export type MemoryFact = { id: string; text: string; source: "chat" | "owner"; at: string }

export type Tri = boolean | "maybe"

export type Group = "start" | "operate" | "hire" | "renew"

export type Requirement = {
  id: string
  name: string
  agency: string
  group: Group
  appliesWhen: (p: Profile) => Tri
  optional?: boolean
  prerequisites: string[]
  documents: string[]
  fee: string
  processingTime: string
  renewal: string
  whereToFile: string
  officeType: OfficeType
  explainer: string
  sourceUrl: string
  lastVerified: string | null // null until signed off by the agency / pilot LGU
}

export type Status =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "approved"
  | "expiring"
  | "expired"

export type ItemState = { status: Status; expiresOn?: string }

export type ComplianceItem = Requirement & {
  applies: Tri
  status: Status
  expiresOn?: string
}

export type OfficeType =
  | "dti"
  | "sec"
  | "cda"
  | "barangay"
  | "bplo"
  | "bir_rdo"
  | "bfp"
  | "health"
  | "cenro"
  | "fda"
  | "sss"
  | "philhealth"
  | "pagibig"
  | "dole"
  | "negosyo_center"
  | "online"

export type Office = {
  type: OfficeType
  name: string
  note: string
  url?: string
}

export type Deadline = {
  id: string
  title: string
  form: string
  due: string // YYYY-MM-DD, already shifted off weekends
  note?: string
}

export const STATUS_LABEL: Record<Status, string> = {
  not_started: "Hindi pa nasisimulan · Not started",
  in_progress: "Ginagawa · In progress",
  submitted: "Naipasa · Submitted",
  approved: "Aprubado · Approved",
  expiring: "Malapit nang mag-expire · Expiring",
  expired: "Expired",
}

// --- Document vault ---------------------------------------------------------

export type DocType =
  | "valid_id"
  | "dti_cert"
  | "sec_cert"
  | "cda_cert"
  | "brgy_clearance"
  | "cedula"
  | "lease"
  | "mayors_permit"
  | "fsic"
  | "sanitary_permit"
  | "health_cert"
  | "bir_cor"
  | "bmbe_cert"
  | "fda_lto"
  | "sss_er"
  | "philhealth_er"
  | "pagibig_er"
  | "other"

// What the AI (or the owner) read off the document. Empty string = not found.
export type Extracted = {
  docType: DocType | Unknown
  ownerName: string
  businessName: string
  address: string
  number: string // certificate / registration / ID number
  tin: string
  issuedOn: string // YYYY-MM-DD
  expiresOn: string // YYYY-MM-DD
  source: "ai" | "filename" | "owner"
  original?: Omit<Extracted, "original" | "corrections"> // first reader output, preserved when corrected
  corrections?: Partial<Omit<Extracted, "original" | "corrections">> // owner-entered changes, not proof of issuance
}

export type Check = { id: string; label: string; result: "pass" | "warn" | "fail"; detail: string }

export type Verdict = "verified" | "needs_review" | "rejected"

export type VaultDoc = {
  id: string
  fileName: string
  mime: string
  size: number
  sha256: string
  uploadedAt: string
  requirementId?: string
  expectedTypes: DocType[] // what the owner said it is / the slot it was uploaded for
  extracted: Extracted
  checks: Check[]
  verdict: Verdict
  ownerConfirmed: boolean
  storagePath?: string // copy in Supabase Storage, when the backend is on
}

export type VaultEvent = { at: string; docId: string; docName: string; event: string }
