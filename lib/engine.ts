// The requirements engine: a rules table, not AI. Every checklist item and
// calendar date comes from a rule on the profile, so legal outcomes never
// depend on a language model. AI only explains and fills.
import type {
  ComplianceItem,
  Deadline,
  Flag,
  ItemState,
  Profile,
  Requirement,
  Status,
  Tri,
} from "./types"

// ---------------------------------------------------------------------------
// Tri-state helpers: "unknown" answers become "maybe" (possibly required).

const is = <K extends keyof Profile>(
  p: Profile,
  key: K,
  ...values: Profile[K][]
): Tri => (p[key] === "unknown" ? "maybe" : values.includes(p[key]))

const flag = (p: Profile, f: Flag): Tri => {
  const v = p.flags[f]
  return v === "unknown" ? "maybe" : Boolean(v)
}

const and = (...xs: Tri[]): Tri =>
  xs.includes(false) ? false : xs.includes("maybe") ? "maybe" : true

const or = (...xs: Tri[]): Tri =>
  xs.includes(true) ? true : xs.includes("maybe") ? "maybe" : false

const not = (x: Tri): Tri => (x === "maybe" ? "maybe" : !x)

const always = (): Tri => true
const sole = (p: Profile) => is(p, "structure", "sole")
const employer = (p: Profile) =>
  is(p, "employees", "1_9", "10_99", "100_plus")
const sellsOnline = (p: Profile) => is(p, "channel", "online", "both")
const servesFood = (p: Profile) =>
  or(is(p, "category", "food_service", "packaged_food"), flag(p, "food"))
const vatRegistered = (p: Profile) => is(p, "sales", "over_3m")

// ---------------------------------------------------------------------------
// Seed rules table (PRD §6–7: universal path, employer path, and the four MVP
// business types). Every row is unverified until an agency / pilot LGU signs
// it off, so lastVerified stays null and the UI says so.

const NEGOSYO = "DTI Negosyo Center"

export const REQUIREMENTS: Requirement[] = [
  {
    id: "dti_bn",
    name: "Business name registration",
    agency: "DTI (BNRS)",
    group: "start",
    appliesWhen: sole,
    prerequisites: [],
    documents: ["Valid government ID"],
    fee: "Depends on territorial scope (barangay to national)",
    processingTime: "Same day online",
    renewal: "Every 5 years",
    whereToFile: "https://bnrs.dti.gov.ph",
    officeType: "dti",
    explainer:
      "Nirerehistro mo ang pangalan ng negosyo mo sa DTI para walang ibang gumamit nito. Sole proprietors only.",
    sourceUrl: "https://bnrs.dti.gov.ph",
    lastVerified: null,
  },
  {
    id: "sec_reg",
    name: "Company registration",
    agency: "SEC (eSPARC / Philippine Business Hub)",
    group: "start",
    appliesWhen: (p) => is(p, "structure", "partnership", "corporation"),
    prerequisites: [],
    documents: ["Articles of partnership / incorporation", "By-laws or OPC documents"],
    fee: "Based on capital",
    processingTime: "A few days online",
    renewal: "Annual GIS and AFS filings",
    whereToFile: "https://business.gov.ph",
    officeType: "sec",
    explainer:
      "Partnerships at corporations (kasama ang One Person Corporation) ay nirerehistro sa SEC, hindi sa DTI.",
    sourceUrl: "https://business.gov.ph",
    lastVerified: null,
  },
  {
    id: "cda_reg",
    name: "Cooperative registration",
    agency: "CDA",
    group: "start",
    appliesWhen: (p) => is(p, "structure", "cooperative"),
    prerequisites: [],
    documents: ["CDA registration forms"],
    fee: "Varies",
    processingTime: "Varies",
    renewal: "Annual reports",
    whereToFile: "https://cda.gov.ph",
    officeType: "cda",
    explainer: "Ang mga kooperatiba ay nirerehistro sa Cooperative Development Authority.",
    sourceUrl: "https://cda.gov.ph",
    lastVerified: null,
  },
  {
    id: "brgy_clearance",
    name: "Barangay business clearance",
    agency: "Barangay hall",
    group: "start",
    appliesWhen: always,
    prerequisites: ["dti_bn", "sec_reg", "cda_reg"],
    documents: [
      "DTI / SEC / CDA certificate",
      "Lease contract, land title, or owner's consent (if home-based)",
      "Community tax certificate (cedula)",
      "Valid ID",
    ],
    fee: "Set by the barangay",
    processingTime: "Same day to a few days",
    renewal: "Yearly, before the Mayor's Permit renewal",
    whereToFile: "Your barangay hall",
    officeType: "barangay",
    explainer:
      "Patunay ng barangay na pinapayagan ang negosyo mo sa lugar ninyo. Kailangan ito bago ang Mayor's Permit.",
    sourceUrl: "https://www.dilg.gov.ph",
    lastVerified: null,
  },
  {
    id: "mayors_permit",
    name: "Mayor's / Business Permit",
    agency: "City / municipal BPLO (e-BOSS)",
    group: "start",
    appliesWhen: always,
    prerequisites: ["brgy_clearance"],
    documents: [
      "Unified business permit application form",
      "DTI / SEC / CDA certificate",
      "Barangay business clearance",
      "Lease contract or land title (TCT)",
      "Cedula",
      "Zoning, fire (FSIC), sanitary and other clearances as the LGU requires",
    ],
    fee: "Set by the LGU (based on gross sales / capital)",
    processingTime: "Within 3 days for simple applications under RA 11032",
    renewal: "Yearly — expires Dec 31, renew in January",
    whereToFile: "City or municipal hall BPLO (often an online e-BOSS)",
    officeType: "bplo",
    explainer:
      "Kailangan ito ng LAHAT ng negosyo — kahit home-based o online lang. Nag-e-expire ito tuwing Dec 31.",
    sourceUrl: "https://arta.gov.ph",
    lastVerified: null,
  },
  {
    id: "fsic",
    name: "Fire Safety Inspection Certificate (FSIC)",
    agency: "BFP",
    group: "start",
    appliesWhen: (p) =>
      or(is(p, "category", "retail", "food_service", "packaged_food"), is(p, "channel", "physical", "both")),
    prerequisites: [],
    documents: ["Mayor's Permit application", "Fire safety requirements for your space"],
    fee: "Set by BFP",
    processingTime: "Usually processed together with the Mayor's Permit",
    renewal: "Yearly",
    whereToFile: "BFP desk at your city hall's e-BOSS",
    officeType: "bfp",
    explainer: "Inspeksyon ng Bureau of Fire Protection para siguradong ligtas sa sunog ang puwesto mo.",
    sourceUrl: "https://bfp.gov.ph",
    lastVerified: null,
  },
  {
    id: "sanitary_permit",
    name: "Sanitary permit",
    agency: "City / municipal health office",
    group: "start",
    appliesWhen: servesFood,
    prerequisites: [],
    documents: ["Health certificates of food handlers", "Water analysis (if applicable)"],
    fee: "Set by the LGU",
    processingTime: "Days, after inspection",
    renewal: "Yearly",
    whereToFile: "City health office",
    officeType: "health",
    explainer: "Kailangan ito kung nagbebenta o naghahanda ka ng pagkain o inumin.",
    sourceUrl: "https://doh.gov.ph",
    lastVerified: null,
  },
  {
    id: "health_certs",
    name: "Health certificates for food handlers",
    agency: "City / municipal health office",
    group: "operate",
    appliesWhen: (p) => is(p, "category", "food_service", "packaged_food"),
    prerequisites: [],
    documents: ["Medical exam results per food handler"],
    fee: "Set by the LGU, per person",
    processingTime: "Days",
    renewal: "Yearly, per staff",
    whereToFile: "City health office",
    officeType: "health",
    explainer: "Bawat taong humahawak ng pagkain (ikaw at ang staff mo) ay kailangan ng health card.",
    sourceUrl: "https://doh.gov.ph",
    lastVerified: null,
  },
  {
    id: "cenro",
    name: "Environmental (CENRO) clearance",
    agency: "City ENRO",
    group: "start",
    appliesWhen: (p) => is(p, "category", "food_service"),
    prerequisites: [],
    documents: ["Waste management plan / grease trap details"],
    fee: "Set by the LGU",
    processingTime: "Days",
    renewal: "Yearly",
    whereToFile: "City ENRO desk at the e-BOSS",
    officeType: "cenro",
    explainer: "Patunay na maayos ang pagtapon mo ng basura at mantika.",
    sourceUrl: "https://denr.gov.ph",
    lastVerified: null,
  },
  {
    id: "liquor_license",
    name: "Liquor license",
    agency: "City / municipal BPLO",
    group: "start",
    appliesWhen: (p) =>
      and(is(p, "category", "retail", "food_service"), flag(p, "alcohol")),
    prerequisites: ["mayors_permit"],
    documents: ["Mayor's Permit", "LGU liquor permit application"],
    fee: "Set by the LGU",
    processingTime: "Days",
    renewal: "Yearly",
    whereToFile: "City hall BPLO",
    officeType: "bplo",
    explainer: "Kailangan kung magbebenta o magse-serve ka ng alak.",
    sourceUrl: "https://arta.gov.ph",
    lastVerified: null,
  },
  {
    id: "bir_cor",
    name: "BIR registration and Certificate of Registration (COR)",
    agency: "BIR (ORUS), your assigned RDO",
    group: "start",
    appliesWhen: always,
    prerequisites: ["dti_bn", "sec_reg", "cda_reg"],
    documents: [
      "BIR Form 1901 (individuals) or 1903 (non-individuals)",
      "DTI / SEC certificate",
      "Valid ID",
      "Proof of business address",
    ],
    fee: "₱30 documentary stamp tax (the ₱500 annual registration fee is abolished)",
    processingTime: "Same day to a few days via ORUS",
    renewal: "Update when details change (BIR Form 1905)",
    whereToFile: "https://orus.bir.gov.ph",
    officeType: "bir_rdo",
    explainer:
      "Lahat ng negosyo — kasama ang online sellers at sari-sari stores — ay kailangang rehistrado sa BIR. Dito mo makukuha ang COR (Form 2303).",
    sourceUrl: "https://orus.bir.gov.ph",
    lastVerified: null,
  },
  {
    id: "bir_books",
    name: "Books of accounts registration",
    agency: "BIR (ORUS)",
    group: "start",
    appliesWhen: always,
    prerequisites: ["bir_cor"],
    documents: ["Manual, loose-leaf, or computerized books"],
    fee: "None",
    processingTime: "Same day via ORUS",
    renewal: "Per current BIR timelines",
    whereToFile: "https://orus.bir.gov.ph",
    officeType: "bir_rdo",
    explainer: "Ang libro kung saan mo itinatala ang benta at gastos ng negosyo.",
    sourceUrl: "https://orus.bir.gov.ph",
    lastVerified: null,
  },
  {
    id: "bir_invoices",
    name: "Invoices (Authority to Print or e-invoicing)",
    agency: "BIR, accredited printer or CAS",
    group: "start",
    appliesWhen: always,
    prerequisites: ["bir_cor"],
    documents: ["Request via ORUS / accredited printer"],
    fee: "Printer's charges",
    processingTime: "Days",
    renewal: "When your stock runs out",
    whereToFile: "https://orus.bir.gov.ph",
    officeType: "bir_rdo",
    explainer: "Rehistradong resibo/invoice na ibinibigay mo sa bawat benta.",
    sourceUrl: "https://orus.bir.gov.ph",
    lastVerified: null,
  },
  {
    id: "bir_display",
    name: "Display BIR COR and \"Ask for Invoice\" notice",
    agency: "BIR",
    group: "operate",
    appliesWhen: always,
    prerequisites: ["bir_cor"],
    documents: ["COR (Form 2303)", "QR registration seal (online sellers: on your store page)"],
    fee: "None",
    processingTime: "—",
    renewal: "Ongoing",
    whereToFile: "Your store, or your online store page",
    officeType: "online",
    explainer: "Idikit ang COR at \"Ask for Invoice\" sa puwesto mo — o ilagay ang QR seal sa online shop mo.",
    sourceUrl: "https://www.bir.gov.ph",
    lastVerified: null,
  },
  {
    id: "tax_option",
    name: "Choose your income tax option (8% vs graduated)",
    agency: "BIR (declared on your first quarterly return)",
    group: "operate",
    appliesWhen: (p) => and(sole(p), is(p, "sales", "under_500k", "500k_3m")),
    prerequisites: ["bir_cor"],
    documents: ["First BIR 1701Q of the year"],
    fee: "None",
    processingTime: "—",
    renewal: "Yearly election",
    whereToFile: "On your first 1701Q",
    officeType: "bir_rdo",
    explainer:
      "Puwede kang pumili ng 8% flat tax o graduated rates kung wala pang ₱3M ang benta mo. HERMIT shows the comparison; an accountant should confirm — we never decide for you.",
    sourceUrl: "https://www.bir.gov.ph",
    lastVerified: null,
  },
  {
    id: "platform_withholding",
    name: "Track platform withholding tax (online sellers)",
    agency: "BIR",
    group: "operate",
    appliesWhen: sellsOnline,
    prerequisites: ["bir_cor"],
    documents: [
      "Platform withholding certificates",
      "Sworn declaration of exemption if yearly sales are under ₱500K",
    ],
    fee: "None",
    processingTime: "—",
    renewal: "Ongoing",
    whereToFile: "Submit declaration to each platform (Shopee, Lazada, TikTok Shop)",
    officeType: "online",
    explainer:
      "Kinakaltasan ng platform ang remittance mo (1% sa kalahati ng gross). Kung wala pang ₱500K ang benta mo sa isang taon, puwede kang mag-submit ng exemption declaration.",
    sourceUrl: "https://www.bir.gov.ph",
    lastVerified: null,
  },
  {
    id: "bmbe",
    name: "BMBE Certificate of Authority",
    agency: NEGOSYO,
    group: "start",
    optional: true,
    appliesWhen: (p) => and(is(p, "assets", "under_3m"), not(flag(p, "professional"))),
    prerequisites: ["dti_bn", "sec_reg", "cda_reg"],
    documents: ["BMBE application form", "DTI / SEC / CDA certificate"],
    fee: "Free",
    processingTime: "Days",
    renewal: "Every 2 years",
    whereToFile: "Nearest DTI Negosyo Center",
    officeType: "negosyo_center",
    explainer:
      "Kung ₱3M pababa ang assets mo (hindi kasama ang lupa), puwede kang maging BMBE — exempt sa income tax. Libre ang application. It does not exempt you from VAT/percentage tax or local fees.",
    sourceUrl: "https://www.dti.gov.ph",
    lastVerified: null,
  },
  {
    id: "fda_lto",
    name: "FDA License to Operate (food manufacturer / trader / distributor)",
    agency: "FDA eServices Portal",
    group: "start",
    appliesWhen: (p) => is(p, "category", "packaged_food"),
    prerequisites: ["mayors_permit"],
    documents: ["Business permits", "Qualified person details", "Floor plan / site details"],
    fee: "Set by FDA",
    processingTime: "Weeks",
    renewal: "Before expiry (validity varies)",
    whereToFile: "https://eservices.fda.gov.ph",
    officeType: "fda",
    explainer:
      "Kung gumagawa o nagre-repack ka ng pagkain para ibenta sa tindahan, kailangan mo ng LTO — kahit outsourced ang paggawa.",
    sourceUrl: "https://www.fda.gov.ph",
    lastVerified: null,
  },
  {
    id: "fda_cpr",
    name: "FDA Certificate of Product Registration (per product)",
    agency: "FDA eServices Portal",
    group: "start",
    appliesWhen: (p) => is(p, "category", "packaged_food"),
    prerequisites: ["fda_lto"],
    documents: ["Compliant product label", "Product specifications"],
    fee: "Per product, set by FDA",
    processingTime: "Weeks",
    renewal: "Before expiry",
    whereToFile: "https://eservices.fda.gov.ph",
    officeType: "fda",
    explainer: "Bawat produkto ay kailangang irehistro sa FDA, may tamang label.",
    sourceUrl: "https://www.fda.gov.ph",
    lastVerified: null,
  },
  {
    id: "regulated_review",
    name: "Extra permits for a regulated activity",
    agency: `${NEGOSYO} (manual review)`,
    group: "start",
    appliesWhen: (p) =>
      or(
        and(flag(p, "fda"), not(is(p, "category", "packaged_food"))),
        flag(p, "fuel"),
        flag(p, "security"),
        flag(p, "lending"),
        flag(p, "import_export"),
        flag(p, "transport"),
        flag(p, "construction"),
        flag(p, "professional")
      ),
    prerequisites: [],
    documents: ["Bring your business details to the Negosyo Center"],
    fee: "Varies",
    processingTime: "Varies",
    renewal: "Varies",
    whereToFile: "Nearest DTI Negosyo Center",
    officeType: "negosyo_center",
    explainer:
      "Ang activity mo ay may dagdag na regulator (FDA, DOE, PRC, SEC/BSP, LTFRB, PCAB, BOC…). HERMIT doesn't cover these yet — a Negosyo Center counselor will confirm.",
    sourceUrl: "https://www.dti.gov.ph",
    lastVerified: null,
  },
  // Employer path
  {
    id: "sss_er",
    name: "SSS employer registration",
    agency: "SSS",
    group: "hire",
    appliesWhen: employer,
    prerequisites: ["mayors_permit"],
    documents: ["SSS Form R-1 / BR-1", "Business documents", "Employee list"],
    fee: "None",
    processingTime: "Days",
    renewal: "Monthly contributions and reports",
    whereToFile: "https://www.sss.gov.ph",
    officeType: "sss",
    explainer: "Kapag may empleyado ka na, kailangan mong magparehistro bilang employer sa SSS.",
    sourceUrl: "https://www.sss.gov.ph",
    lastVerified: null,
  },
  {
    id: "philhealth_er",
    name: "PhilHealth employer registration",
    agency: "PhilHealth",
    group: "hire",
    appliesWhen: employer,
    prerequisites: ["mayors_permit"],
    documents: ["PhilHealth ER1 (Employer Data Record)"],
    fee: "None",
    processingTime: "Days",
    renewal: "Monthly premiums",
    whereToFile: "https://www.philhealth.gov.ph",
    officeType: "philhealth",
    explainer: "Para may PhilHealth coverage ang mga empleyado mo.",
    sourceUrl: "https://www.philhealth.gov.ph",
    lastVerified: null,
  },
  {
    id: "pagibig_er",
    name: "Pag-IBIG employer registration",
    agency: "Pag-IBIG Fund",
    group: "hire",
    appliesWhen: employer,
    prerequisites: ["mayors_permit"],
    documents: ["Pag-IBIG Employer Data Form"],
    fee: "None",
    processingTime: "Days",
    renewal: "Monthly contributions",
    whereToFile: "https://www.pagibigfund.gov.ph",
    officeType: "pagibig",
    explainer: "Para sa savings at housing loan benefits ng mga empleyado mo.",
    sourceUrl: "https://www.pagibigfund.gov.ph",
    lastVerified: null,
  },
  {
    id: "dole_1020",
    name: "DOLE Rule 1020 establishment registration",
    agency: "DOLE field office",
    group: "hire",
    appliesWhen: employer,
    prerequisites: [],
    documents: ["Business documents", "Workplace details"],
    fee: "None",
    processingTime: "Days",
    renewal: "Update on changes; OSH programs",
    whereToFile: "DOLE field office (ideally before operations start)",
    officeType: "dole",
    explainer: "Pagrehistro ng puwesto mo sa DOLE para sa kaligtasan at karapatan ng mga manggagawa.",
    sourceUrl: "https://www.dole.gov.ph",
    lastVerified: null,
  },
  {
    id: "withholding_comp",
    name: "Withholding tax on compensation",
    agency: "BIR",
    group: "hire",
    appliesWhen: employer,
    prerequisites: ["bir_cor"],
    documents: ["BIR 1601-C monthly", "BIR 1604-C and Form 2316 yearly"],
    fee: "None",
    processingTime: "—",
    renewal: "Monthly / annual",
    whereToFile: "https://www.bir.gov.ph (eFPS / eBIRForms)",
    officeType: "bir_rdo",
    explainer: "Ikaw ang magkakaltas at magre-remit ng income tax ng mga empleyado mo.",
    sourceUrl: "https://www.bir.gov.ph",
    lastVerified: null,
  },
  // Renewals
  {
    id: "brgy_renewal",
    name: "Barangay clearance renewal",
    agency: "Barangay hall",
    group: "renew",
    appliesWhen: always,
    prerequisites: ["brgy_clearance"],
    documents: ["Previous clearance", "Cedula"],
    fee: "Set by the barangay",
    processingTime: "Same day",
    renewal: "Yearly, before the Mayor's Permit",
    whereToFile: "Your barangay hall",
    officeType: "barangay",
    explainer: "Taon-taon, unahin ito bago ang Mayor's Permit renewal sa Enero.",
    sourceUrl: "https://www.dilg.gov.ph",
    lastVerified: null,
  },
  {
    id: "mayors_renewal",
    name: "Mayor's Permit renewal (January)",
    agency: "City / municipal BPLO",
    group: "renew",
    appliesWhen: always,
    prerequisites: ["mayors_permit"],
    documents: ["Previous permit", "Barangay clearance (renewed)", "Gross sales declaration"],
    fee: "Set by the LGU (based on last year's gross sales)",
    processingTime: "Days",
    renewal: "Yearly — expires Dec 31",
    whereToFile: "City or municipal hall BPLO / e-BOSS",
    officeType: "bplo",
    explainer: "Nag-e-expire ang Mayor's Permit tuwing Dec 31. I-renew sa Enero para walang multa.",
    sourceUrl: "https://arta.gov.ph",
    lastVerified: null,
  },
]

const byId = new Map(REQUIREMENTS.map((r) => [r.id, r]))
export const getRequirement = (id: string) => byId.get(id)

// ---------------------------------------------------------------------------
// Checklist

const DAY = 86_400_000

function deriveStatus(s: ItemState, today: Date): Status {
  const issued = s.status === "approved" || s.status === "expiring" || s.status === "expired"
  if (!issued || !s.expiresOn) return s.status
  const days = (Date.parse(s.expiresOn) - today.getTime()) / DAY
  return days < 0 ? "expired" : days <= 30 ? "expiring" : "approved"
}

export function buildChecklist(
  p: Profile,
  states: Record<string, ItemState>,
  today = new Date()
): ComplianceItem[] {
  return REQUIREMENTS.flatMap((r) => {
    const applies = r.appliesWhen(p)
    if (applies === false) return []
    const s = states[r.id] ?? {
      status: p.have.includes(r.id) ? "approved" : "not_started",
    }
    return [{ ...r, applies, status: deriveStatus(s, today), expiresOn: s.expiresOn }]
  })
}

// Permits that lapse every Dec 31 get that expiry when marked approved.
export function defaultExpiry(id: string, today = new Date()) {
  return ["mayors_permit", "brgy_clearance", "mayors_renewal", "brgy_renewal"].includes(id)
    ? `${today.getFullYear()}-12-31`
    : undefined
}

export function healthScore(items: ComplianceItem[]) {
  const required = items.filter((i) => i.applies === true && !i.optional)
  const done = required.filter((i) => i.status === "approved" || i.status === "expiring")
  return { done: done.length, total: required.length }
}

// "Hiring your first employee adds 4 new items"
export function diffChecklists(before: Profile, after: Profile) {
  const ids = (p: Profile) =>
    new Set(REQUIREMENTS.filter((r) => r.appliesWhen(p) !== false).map((r) => r.id))
  const a = ids(before)
  const b = ids(after)
  return {
    added: [...b].filter((id) => !a.has(id)).map((id) => byId.get(id)!.name),
    removed: [...a].filter((id) => !b.has(id)).map((id) => byId.get(id)!.name),
  }
}

// ---------------------------------------------------------------------------
// Compliance calendar (PRD §8)

type DeadlineRule = {
  id: string
  title: string
  form: (p: Profile) => string
  who: (p: Profile) => Tri
  dates: [month: number, day: number][] // month 1–12
  note?: string
}

const QUARTERLY_25: [number, number][] = [[1, 25], [4, 25], [7, 25], [10, 25]]
const monthly = (day: number | "end"): [number, number][] =>
  Array.from({ length: 12 }, (_, m) => [m + 1, day === "end" ? 0 : day])

const nonVatPercentageTax = (p: Profile) =>
  and(is(p, "sales", "under_500k", "500k_3m"), or(not(sole(p)), is(p, "taxOption", "graduated")))

const DEADLINE_RULES: DeadlineRule[] = [
  {
    id: "brgy_renewal",
    title: "Barangay clearance renewal",
    form: () => "Barangay form",
    who: always,
    dates: [[1, 10]],
    note: "Suggested date — renew before the Mayor's Permit.",
  },
  {
    id: "mayors_renewal",
    title: "Mayor's Permit renewal",
    form: () => "LGU renewal form",
    who: always,
    dates: [[1, 20]],
    note: "Your permit expires Dec 31.",
  },
  {
    id: "2551q",
    title: "Quarterly percentage tax",
    form: () => "BIR 2551Q",
    who: nonVatPercentageTax,
    dates: QUARTERLY_25,
  },
  {
    id: "2550q",
    title: "Quarterly VAT",
    form: () => "BIR 2550Q",
    who: vatRegistered,
    dates: QUARTERLY_25,
  },
  {
    id: "1701q",
    title: "Quarterly income tax",
    form: () => "BIR 1701Q",
    who: sole,
    dates: [[5, 15], [8, 15], [11, 15]],
  },
  {
    id: "1702q",
    title: "Quarterly income tax",
    form: () => "BIR 1702Q",
    who: (p) => is(p, "structure", "partnership", "corporation"),
    dates: [[5, 30], [8, 29], [11, 29]],
    note: "About 60 days after quarter end.",
  },
  {
    id: "annual_itr",
    title: "Annual income tax return",
    form: (p) => (p.structure === "sole" ? "BIR 1701 / 1701A" : "BIR 1702"),
    who: always,
    dates: [[4, 15]],
  },
  {
    id: "1601c",
    title: "Withholding tax on compensation",
    form: () => "BIR 1601-C",
    who: employer,
    // 10th of the following month; December's is due Jan 15.
    dates: [[1, 15], ...monthly(10).slice(1)],
  },
  {
    id: "sss_philhealth",
    title: "SSS and PhilHealth contributions",
    form: () => "Online payment reference",
    who: employer,
    dates: monthly("end"),
    note: "Exact date depends on your employer number — confirm with SSS / PhilHealth.",
  },
  {
    id: "pagibig",
    title: "Pag-IBIG contributions",
    form: () => "MCRF / online",
    who: employer,
    dates: monthly("end"),
    note: "Exact date depends on your employer name — confirm with Pag-IBIG.",
  },
  {
    id: "1604c",
    title: "Employee certificates and alphalist",
    form: () => "BIR 2316, 1604-C",
    who: employer,
    dates: [[1, 31]],
  },
  {
    id: "13th_month",
    title: "13th month pay",
    form: () => "—",
    who: employer,
    dates: [[12, 24]],
  },
  {
    id: "health_certs",
    title: "Health certificates of food handlers",
    form: () => "LGU health office",
    who: (p) => is(p, "category", "food_service", "packaged_food"),
    dates: [[1, 20]],
    note: "Yearly per staff; usually renewed with the Mayor's Permit.",
  },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)

// ponytail: weekends only; PH holidays and BIR extensions need a maintained
// holiday table (PRD §8) — add it to this function when the dataset exists.
export function shiftToBusinessDay(d: Date) {
  const day = d.getUTCDay()
  const add = day === 6 ? 2 : day === 0 ? 1 : 0
  return new Date(d.getTime() + add * DAY)
}

export function buildCalendar(
  p: Profile,
  items: ComplianceItem[],
  from = new Date(),
  months = 12
): (Deadline & { maybe: boolean })[] {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const end = Date.UTC(from.getFullYear(), from.getMonth() + months, from.getDate())
  const out: (Deadline & { maybe: boolean })[] = []

  for (const rule of DEADLINE_RULES) {
    const who = rule.who(p)
    if (who === false) continue
    for (const year of [from.getFullYear(), from.getFullYear() + 1]) {
      for (const [m, d] of rule.dates) {
        // day 0 of next month = last day of this month
        const raw = new Date(Date.UTC(year, d === 0 ? m : m - 1, d))
        const due = shiftToBusinessDay(raw)
        if (due.getTime() < start || due.getTime() >= end) continue
        out.push({
          id: `${rule.id}:${iso(due)}`,
          title: rule.title,
          form: rule.form(p),
          due: iso(due),
          note: rule.note,
          maybe: who === "maybe",
        })
      }
    }
  }

  // Expiries the owner entered on checklist items (FDA LTO, BMBE, DTI name…)
  for (const item of items) {
    if (!item.expiresOn || DEADLINE_RULES.some((r) => r.id === item.id)) continue
    const t = Date.parse(item.expiresOn)
    if (t < start || t >= end) continue
    out.push({
      id: `expiry:${item.id}`,
      title: `Renew: ${item.name}`,
      form: item.agency,
      due: item.expiresOn,
      maybe: false,
    })
  }

  return out.sort((a, b) => a.due.localeCompare(b.due))
}

// First nudge 14 days before, then 3 days, then on the due date.
export const REMINDER_OFFSETS = [14, 3, 0]
export const reminderDates = (due: string) =>
  REMINDER_OFFSETS.map((n) => iso(new Date(Date.parse(due) - n * DAY)))

export const EMPTY_PROFILE: Profile = {
  ownerName: "",
  birthDate: "",
  homeAddress: "",
  mobile: "",
  email: "",
  identityVerified: false,
  businessName: "",
  description: "",
  category: "unknown",
  psic: "",
  stage: "unknown",
  structure: "unknown",
  businessAddress: "",
  barangay: "",
  region: "",
  province: "",
  city: "",
  premises: "unknown",
  channel: "unknown",
  assets: "unknown",
  sales: "unknown",
  taxOption: "unknown",
  employees: "unknown",
  flags: {},
  have: [],
  lang: "fil",
  reminders: ["sms"],
  extra: {},
}
