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
  // Values typed into form field sheets, remembered for the next form.
  extra: Record<string, string>
}

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
  formIds: string[]
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
