import type { Profile } from "./types"

// Forms catalog: every agency form an MSME is likely to need, with where the
// blank form lives, where it's filed, and which fields HERMIT can pre-fill.
// Fields come from one shared library: what the profile knows is filled in;
// anything else is asked once (on a form sheet or by Kuya Hermit) and
// remembered in profile.extra for every later form.
// ponytail: field sheets, not filled official PDFs. Add a PDF filler (pdf-lib
// over versioned templates) per form once the templates are scraped and
// checked for each version (PRD §9 "forms library").

type FieldDef = { label: string; source?: (p: Profile) => string; hint?: string }

const BANDS: Record<string, Record<string, string>> = {
  assets: { under_3m: "Under ₱3M", "3m_15m": "₱3M – ₱15M", "15m_100m": "₱15M – ₱100M" },
  sales: { under_500k: "Under ₱500K / year", "500k_3m": "₱500K – ₱3M / year", over_3m: "Over ₱3M / year" },
  employees: { none: "0", "1_9": "1 – 9", "10_99": "10 – 99", "100_plus": "100+" },
  structure: { sole: "Sole proprietorship", partnership: "Partnership", corporation: "Corporation / OPC", cooperative: "Cooperative" },
  premises: { home: "Home-based", rented: "Rented", owned: "Owned" },
  taxOption: { "8pct": "8% flat rate", graduated: "Graduated rates" },
}
const band = (k: keyof typeof BANDS, v: string) => BANDS[k][v] ?? ""

export const FIELDS = {
  owner_name: { label: "Owner / taxpayer name", source: (p) => p.ownerName },
  birth_date: { label: "Date of birth", source: (p) => p.birthDate },
  residence: { label: "Residence address", source: (p) => p.homeAddress },
  mobile: { label: "Mobile number", source: (p) => p.mobile },
  email: { label: "Email address", source: (p) => p.email },
  business_name: { label: "Business / trade name", source: (p) => p.businessName },
  business_address: {
    label: "Business address",
    source: (p) => [p.businessAddress, p.barangay && `Brgy. ${p.barangay}`, p.city].filter(Boolean).join(", "),
  },
  barangay: { label: "Barangay", source: (p) => p.barangay },
  city: { label: "City / municipality", source: (p) => p.city },
  activity: { label: "Line of business / activity", source: (p) => p.description },
  psic: { label: "PSIC code", source: (p) => p.psic },
  structure: { label: "Type of organization", source: (p) => band("structure", p.structure) },
  premises: { label: "Place of business is", source: (p) => band("premises", p.premises) },
  employees: { label: "Number of employees", source: (p) => band("employees", p.employees) },
  total_assets: { label: "Total assets (excluding land)", source: (p) => band("assets", p.assets) },
  sales_band: { label: "Estimated yearly sales", source: (p) => band("sales", p.sales) },
  tax_option: { label: "Income tax option", source: (p) => band("taxOption", p.taxOption) },
  tin: { label: "TIN", hint: "From your BIR COR (Form 2303)" },
  rdo_code: { label: "RDO code", hint: "Printed on your COR" },
  dti_no: { label: "DTI / SEC / CDA registration no." },
  dti_validity: { label: "Registration validity / expiry date" },
  sss_er_no: { label: "SSS employer number" },
  philhealth_er_no: { label: "PhilHealth employer number (PEN)" },
  pagibig_er_no: { label: "Pag-IBIG employer ID" },
  start_date: { label: "Date business started / will start" },
  floor_area: { label: "Business area (sq m)" },
  capital: { label: "Capitalization (new business)" },
  gross_sales: { label: "Gross sales / receipts for the period" },
  period: { label: "Return period (quarter / month / year)" },
  employee_count_exact: { label: "Exact number of employees" },
  products: { label: "Products to register (names)" },
  reason: { label: "Reason (update / cancellation / closure)" },
} satisfies Record<string, FieldDef>

export type FieldKey = keyof typeof FIELDS

export type Handoff = "portal" | "print" | "office"

export type FormTemplate = {
  id: string
  code: string // the agency's own form number, if any
  name: string
  short: string // button label
  agency: string
  group: "register" | "tax" | "employer" | "lgu" | "regulated" | "close"
  purpose: string
  requirementIds: string[]
  structures?: Profile["structure"][] // only for these ownership types (default: any)
  handoff: Handoff
  source: string // official page with the blank form / instructions
  portal: string // where it's filed
  fields: FieldKey[]
}

const BIR_FORMS = "https://www.bir.gov.ph/bir-forms"
const ORUS = "https://orus.bir.gov.ph"
const EBIR = "https://www.bir.gov.ph/ebirforms"

const ID: FieldKey[] = ["owner_name", "birth_date", "residence", "mobile", "email"]
const BIZ: FieldKey[] = ["business_name", "business_address", "barangay", "city"]

export const FORMS: FormTemplate[] = [
  // --- Registration ---------------------------------------------------------
  { id: "dti_bn", structures: ["sole"], code: "BNRS", name: "DTI Business Name Registration", short: "DTI business name", agency: "DTI", group: "register", purpose: "Register your business name (sole proprietors).", requirementIds: ["dti_bn"], handoff: "portal", source: "https://bnrs.dti.gov.ph", portal: "https://bnrs.dti.gov.ph", fields: [...ID, "business_name", "business_address", "activity"] },
  { id: "dti_bn_renewal", structures: ["sole"], code: "BNRS", name: "DTI Business Name Renewal", short: "DTI renewal", agency: "DTI", group: "register", purpose: "Renew your business name every 5 years.", requirementIds: ["dti_bn"], handoff: "portal", source: "https://bnrs.dti.gov.ph", portal: "https://bnrs.dti.gov.ph", fields: ["owner_name", "business_name", "dti_no", "dti_validity"] },
  { id: "sec_reg", structures: ["partnership", "corporation"], code: "eSPARC", name: "SEC Company Registration (incl. OPC)", short: "SEC registration", agency: "SEC", group: "register", purpose: "Register a partnership, corporation or One Person Corporation.", requirementIds: ["sec_reg"], handoff: "portal", source: "https://esparc.sec.gov.ph", portal: "https://esparc.sec.gov.ph", fields: [...ID, "business_name", "business_address", "activity", "capital"] },
  { id: "pbh", structures: ["partnership", "corporation"], code: "PBH", name: "Philippine Business Hub (SEC + BIR + SSS + PhilHealth + Pag-IBIG)", short: "Business Hub", agency: "ARTA / DICT", group: "register", purpose: "One application that routes company, tax and employer registration.", requirementIds: ["sec_reg", "bir_cor", "sss_er", "philhealth_er", "pagibig_er"], handoff: "portal", source: "https://business.gov.ph", portal: "https://business.gov.ph", fields: [...ID, ...BIZ, "activity", "structure", "employees"] },
  { id: "cda_reg", structures: ["cooperative"], code: "CDA", name: "CDA Cooperative Registration", short: "CDA registration", agency: "CDA", group: "register", purpose: "Register a cooperative.", requirementIds: ["cda_reg"], handoff: "office", source: "https://cda.gov.ph", portal: "https://cda.gov.ph", fields: [...ID, "business_name", "business_address", "activity", "capital"] },
  { id: "bir_1901", structures: ["sole"], code: "1901", name: "BIR Form 1901 — Application for Registration (individuals)", short: "BIR 1901", agency: "BIR", group: "register", purpose: "Register as a self-employed / sole proprietor taxpayer and get your COR.", requirementIds: ["bir_cor"], handoff: "portal", source: BIR_FORMS, portal: ORUS, fields: [...ID, ...BIZ, "activity", "psic", "tin", "dti_no", "tax_option", "start_date"] },
  { id: "bir_1903", structures: ["partnership", "corporation", "cooperative"], code: "1903", name: "BIR Form 1903 — Application for Registration (corporations / partnerships)", short: "BIR 1903", agency: "BIR", group: "register", purpose: "Register a corporation, partnership or OPC with BIR.", requirementIds: ["bir_cor"], handoff: "portal", source: BIR_FORMS, portal: ORUS, fields: ["owner_name", "mobile", "email", ...BIZ, "activity", "psic", "dti_no", "start_date"] },
  { id: "bir_1905", code: "1905", name: "BIR Form 1905 — Registration Update / Cancellation", short: "BIR 1905", agency: "BIR", group: "register", purpose: "Update registered details (address, line of business) or cancel registration.", requirementIds: ["bir_cor"], handoff: "portal", source: BIR_FORMS, portal: ORUS, fields: ["owner_name", "tin", "rdo_code", ...BIZ, "reason"] },
  { id: "bir_books", code: "ORUS", name: "BIR Books of Accounts Registration", short: "Books registration", agency: "BIR", group: "register", purpose: "Register your manual, loose-leaf or computerized books.", requirementIds: ["bir_books"], handoff: "portal", source: ORUS, portal: ORUS, fields: ["owner_name", "tin", "rdo_code", "business_name"] },
  { id: "bir_1906", code: "1906", name: "BIR Form 1906 — Authority to Print invoices", short: "BIR 1906", agency: "BIR", group: "register", purpose: "Get authority to print registered invoices.", requirementIds: ["bir_invoices"], handoff: "portal", source: BIR_FORMS, portal: ORUS, fields: ["owner_name", "tin", "rdo_code", "business_name", "business_address"] },
  { id: "bmbe", code: "BMBE", name: "BMBE Application Form", short: "BMBE form", agency: "DTI Negosyo Center", group: "register", purpose: "Apply for Barangay Micro Business Enterprise income tax exemption (assets ₱3M or less).", requirementIds: ["bmbe"], handoff: "office", source: "https://www.dti.gov.ph", portal: "https://www.dti.gov.ph", fields: ["owner_name", "mobile", ...BIZ, "activity", "total_assets", "employees", "dti_no", "tin"] },

  // --- LGU ------------------------------------------------------------------
  { id: "brgy_clearance", code: "Barangay", name: "Barangay Business Clearance Application", short: "barangay clearance form", agency: "Barangay hall", group: "lgu", purpose: "Barangay clearance needed before the Mayor's Permit.", requirementIds: ["brgy_clearance", "brgy_renewal"], handoff: "office", source: "https://www.dilg.gov.ph", portal: "Your barangay hall", fields: ["owner_name", "residence", "mobile", ...BIZ, "activity", "premises", "dti_no"] },
  { id: "cedula", code: "CTC", name: "Community Tax Certificate (Cedula)", short: "cedula", agency: "City treasurer / barangay", group: "lgu", purpose: "Yearly community tax certificate, required for permits.", requirementIds: ["brgy_clearance", "mayors_permit"], handoff: "office", source: "https://www.dilg.gov.ph", portal: "City treasurer or barangay hall", fields: ["owner_name", "birth_date", "residence", "gross_sales"] },
  { id: "lgu_permit", code: "UBPA", name: "Unified Business Permit Application (new / renewal)", short: "business permit form", agency: "City BPLO", group: "lgu", purpose: "Mayor's / Business Permit, new or January renewal.", requirementIds: ["mayors_permit", "mayors_renewal"], handoff: "office", source: "https://www.taguig.gov.ph", portal: "City hall BPLO / e-BOSS", fields: ["owner_name", "mobile", "email", ...BIZ, "structure", "premises", "employees", "dti_no", "tin", "floor_area", "capital", "gross_sales"] },
  { id: "zoning", code: "Zoning", name: "Zoning / Locational Clearance", short: "zoning clearance", agency: "City zoning office", group: "lgu", purpose: "Confirms your business is allowed at that address (often part of the e-BOSS).", requirementIds: ["mayors_permit"], handoff: "office", source: "https://www.taguig.gov.ph", portal: "City hall e-BOSS", fields: ["owner_name", ...BIZ, "activity", "premises", "floor_area"] },
  { id: "fsic", code: "FSIC", name: "BFP Fire Safety Inspection Certificate Application", short: "FSIC form", agency: "BFP", group: "lgu", purpose: "Fire safety inspection for your place of business.", requirementIds: ["fsic"], handoff: "office", source: "https://bfp.gov.ph", portal: "BFP desk at the e-BOSS", fields: ["owner_name", "mobile", ...BIZ, "floor_area", "employees"] },
  { id: "sanitary", code: "Sanitary", name: "Sanitary Permit Application", short: "sanitary permit form", agency: "City health office", group: "lgu", purpose: "Required for food and drink businesses.", requirementIds: ["sanitary_permit"], handoff: "office", source: "https://doh.gov.ph", portal: "City health office", fields: ["owner_name", "mobile", ...BIZ, "activity", "employee_count_exact"] },
  { id: "health_card", code: "Health card", name: "Health Certificate (per food handler)", short: "health card form", agency: "City health office", group: "lgu", purpose: "Yearly health certificate for everyone who handles food.", requirementIds: ["health_certs"], handoff: "office", source: "https://doh.gov.ph", portal: "City health office", fields: ["owner_name", "birth_date", "residence", "business_name"] },
  { id: "lgu_retirement", code: "Retirement", name: "Business Retirement (closure) Application", short: "business retirement", agency: "City BPLO", group: "close", purpose: "Officially close your business with the LGU so fees stop accruing.", requirementIds: [], handoff: "office", source: "https://www.taguig.gov.ph", portal: "City hall BPLO", fields: ["owner_name", ...BIZ, "gross_sales", "reason"] },

  // --- Tax returns ----------------------------------------------------------
  { id: "bir_0605", code: "0605", name: "BIR Form 0605 — Payment Form", short: "BIR 0605", agency: "BIR", group: "tax", purpose: "Pay fees and penalties that have no return of their own.", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "period"] },
  { id: "bir_2551q", code: "2551Q", name: "BIR Form 2551Q — Quarterly Percentage Tax", short: "BIR 2551Q", agency: "BIR", group: "tax", purpose: "Quarterly percentage tax for non-VAT taxpayers not on the 8% option.", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "business_address", "period", "gross_sales"] },
  { id: "bir_2550q", code: "2550Q", name: "BIR Form 2550Q — Quarterly VAT Return", short: "BIR 2550Q", agency: "BIR", group: "tax", purpose: "Quarterly VAT return for VAT-registered businesses.", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "business_address", "period", "gross_sales"] },
  { id: "bir_1701q", structures: ["sole"], code: "1701Q", name: "BIR Form 1701Q — Quarterly Income Tax (individuals)", short: "BIR 1701Q", agency: "BIR", group: "tax", purpose: "Quarterly income tax for sole proprietors; where you elect the 8% option.", requirementIds: ["tax_option"], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "birth_date", "residence", "tax_option", "period", "gross_sales"] },
  { id: "bir_1701", structures: ["sole"], code: "1701 / 1701A", name: "BIR Form 1701 / 1701A — Annual Income Tax (individuals)", short: "BIR 1701", agency: "BIR", group: "tax", purpose: "Annual income tax return for sole proprietors, due April 15.", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "birth_date", "residence", "tax_option", "gross_sales"] },
  { id: "bir_1702q", structures: ["partnership", "corporation", "cooperative"], code: "1702Q", name: "BIR Form 1702Q — Quarterly Income Tax (corporations)", short: "BIR 1702Q", agency: "BIR", group: "tax", purpose: "Quarterly income tax for corporations, partnerships and OPCs.", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["business_name", "tin", "rdo_code", "business_address", "period", "gross_sales"] },
  { id: "bir_1702", structures: ["partnership", "corporation", "cooperative"], code: "1702-RT/EX/MX", name: "BIR Form 1702 — Annual Income Tax (corporations)", short: "BIR 1702", agency: "BIR", group: "tax", purpose: "Annual income tax for corporations and partnerships.", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["business_name", "tin", "rdo_code", "business_address", "gross_sales"] },
  { id: "bir_0619e", code: "0619-E", name: "BIR Form 0619-E — Monthly Expanded Withholding Remittance", short: "BIR 0619-E", agency: "BIR", group: "tax", purpose: "Monthly remittance of expanded withholding tax (withholding agents).", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "period"] },
  { id: "bir_1601eq", code: "1601-EQ", name: "BIR Form 1601-EQ — Quarterly Expanded Withholding Return", short: "BIR 1601-EQ", agency: "BIR", group: "tax", purpose: "Quarterly expanded withholding return (withholding agents).", requirementIds: [], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "period"] },
  { id: "bir_2307", code: "2307", name: "BIR Form 2307 — Certificate of Creditable Tax Withheld", short: "BIR 2307", agency: "BIR", group: "tax", purpose: "Proof of tax withheld from you (e.g. by Shopee/Lazada); keep it to claim the credit.", requirementIds: ["platform_withholding"], handoff: "print", source: BIR_FORMS, portal: "Request from the platform / payor", fields: ["owner_name", "tin", "business_address", "period"] },
  { id: "bir_withholding_exemption", code: "Sworn declaration", name: "Sworn Declaration of Gross Sales under ₱500K (online sellers)", short: "₱500K declaration", agency: "BIR / e-marketplace", group: "tax", purpose: "Exempts small online sellers from platform withholding for the year.", requirementIds: ["platform_withholding"], handoff: "print", source: "https://www.bir.gov.ph", portal: "Submit to each platform", fields: ["owner_name", "tin", "business_name", "business_address", "sales_band"] },

  // --- Employer -------------------------------------------------------------
  { id: "sss_r1", code: "R-1", name: "SSS Form R-1 — Employer Registration", short: "SSS R-1", agency: "SSS", group: "employer", purpose: "Register as an employer with SSS.", requirementIds: ["sss_er"], handoff: "office", source: "https://www.sss.gov.ph", portal: "https://www.sss.gov.ph", fields: ["owner_name", "mobile", "email", ...BIZ, "structure", "activity", "tin", "start_date", "employee_count_exact"] },
  { id: "sss_r1a", code: "R-1A", name: "SSS Form R-1A — Employment Report", short: "SSS R-1A", agency: "SSS", group: "employer", purpose: "Report your employees to SSS (on registration and each new hire).", requirementIds: ["sss_er"], handoff: "office", source: "https://www.sss.gov.ph", portal: "https://www.sss.gov.ph", fields: ["business_name", "sss_er_no", "business_address", "employee_count_exact"] },
  { id: "philhealth_er1", code: "ER1", name: "PhilHealth ER1 — Employer Data Record", short: "PhilHealth ER1", agency: "PhilHealth", group: "employer", purpose: "Register as an employer with PhilHealth.", requirementIds: ["philhealth_er"], handoff: "office", source: "https://www.philhealth.gov.ph/partners/employers/", portal: "PhilHealth LHIO", fields: ["owner_name", "mobile", "email", ...BIZ, "structure", "tin", "employee_count_exact"] },
  { id: "philhealth_er2", code: "ER2", name: "PhilHealth ER2 — Report of Employee-Members", short: "PhilHealth ER2", agency: "PhilHealth", group: "employer", purpose: "List your employees for PhilHealth coverage.", requirementIds: ["philhealth_er"], handoff: "office", source: "https://www.philhealth.gov.ph/downloads/", portal: "PhilHealth LHIO", fields: ["business_name", "philhealth_er_no", "business_address", "employee_count_exact"] },
  { id: "pagibig_edf", code: "EDF", name: "Pag-IBIG Employer's Data Form", short: "Pag-IBIG EDF", agency: "Pag-IBIG Fund", group: "employer", purpose: "Register as an employer with Pag-IBIG.", requirementIds: ["pagibig_er"], handoff: "office", source: "https://www.pagibigfund.gov.ph/forms.html", portal: "https://www.pagibigfund.gov.ph/employers.html", fields: ["owner_name", "mobile", "email", ...BIZ, "structure", "tin", "employee_count_exact"] },
  { id: "pagibig_mcrf", code: "MCRF", name: "Pag-IBIG Membership Contribution Remittance Form", short: "Pag-IBIG MCRF", agency: "Pag-IBIG Fund", group: "employer", purpose: "Monthly Pag-IBIG contribution remittance.", requirementIds: ["pagibig_er"], handoff: "print", source: "https://www.pagibigfund.gov.ph/forms.html", portal: "Pag-IBIG branch / accredited collecting partner", fields: ["business_name", "pagibig_er_no", "business_address", "period"] },
  { id: "dole_1020", code: "Rule 1020", name: "DOLE Rule 1020 Establishment Registration", short: "DOLE 1020", agency: "DOLE", group: "employer", purpose: "Register your workplace with DOLE.", requirementIds: ["dole_1020"], handoff: "office", source: "https://www.dole.gov.ph", portal: "DOLE field office", fields: ["owner_name", "mobile", "email", ...BIZ, "activity", "employee_count_exact", "floor_area"] },
  { id: "bir_1601c", code: "1601-C", name: "BIR Form 1601-C — Monthly Withholding on Compensation", short: "BIR 1601-C", agency: "BIR", group: "employer", purpose: "Monthly remittance of tax withheld from employees' pay.", requirementIds: ["withholding_comp"], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "period", "employee_count_exact"] },
  { id: "bir_1604c", code: "1604-C", name: "BIR Form 1604-C — Annual Information Return (compensation)", short: "BIR 1604-C", agency: "BIR", group: "employer", purpose: "Yearly summary of tax withheld from employees, due January 31.", requirementIds: ["withholding_comp"], handoff: "portal", source: BIR_FORMS, portal: EBIR, fields: ["owner_name", "tin", "rdo_code", "employee_count_exact"] },
  { id: "bir_2316", code: "2316", name: "BIR Form 2316 — Employee Certificate of Compensation", short: "BIR 2316", agency: "BIR", group: "employer", purpose: "Give each employee their yearly compensation and tax certificate.", requirementIds: ["withholding_comp"], handoff: "print", source: BIR_FORMS, portal: "Give to each employee", fields: ["business_name", "tin", "business_address"] },

  // --- Regulated --------------------------------------------------------------
  { id: "fda_lto", code: "LTO", name: "FDA License to Operate Application", short: "FDA LTO", agency: "FDA", group: "regulated", purpose: "License to operate as a food manufacturer, trader or distributor.", requirementIds: ["fda_lto"], handoff: "portal", source: "https://eservices.fda.gov.ph", portal: "https://eservices.fda.gov.ph", fields: ["owner_name", "mobile", "email", ...BIZ, "activity", "tin", "dti_no"] },
  { id: "fda_cpr", code: "CPR", name: "FDA Certificate of Product Registration Application", short: "FDA CPR", agency: "FDA", group: "regulated", purpose: "Register each food product you sell.", requirementIds: ["fda_cpr"], handoff: "portal", source: "https://eservices.fda.gov.ph", portal: "https://eservices.fda.gov.ph", fields: ["business_name", "business_address", "products"] },
  { id: "boc_cprs", code: "CPRS", name: "BOC Client Profile Registration (importer / exporter)", short: "BOC CPRS", agency: "Bureau of Customs", group: "regulated", purpose: "Accreditation to import or export.", requirementIds: ["regulated_review"], handoff: "portal", source: "https://cprs.customs.gov.ph", portal: "https://cprs.customs.gov.ph", fields: ["owner_name", "mobile", "email", ...BIZ, "tin", "dti_no"] },
]

export const getForm = (id: string) => FORMS.find((f) => f.id === id)

// "unknown" ownership keeps every form (stricter path: show, don't hide).
export const fitsProfile = (f: FormTemplate, p: Profile) =>
  !f.structures || p.structure === "unknown" || f.structures.includes(p.structure)

export const formsFor = (requirementId: string, p?: Profile) =>
  FORMS.filter((f) => f.requirementIds.includes(requirementId) && (!p || fitsProfile(f, p)))

export function fillForm(form: FormTemplate, p: Profile) {
  return form.fields.map((key) => {
    const def: FieldDef = FIELDS[key]
    const value = def.source?.(p) || p.extra[key] || ""
    return { key, label: def.label, hint: def.hint, fromProfile: Boolean(def.source?.(p)), value, missing: !value }
  })
}

export const HANDOFF_LABEL: Record<Handoff, string> = {
  portal: "I-file online · File online",
  print: "I-print / ibigay · Print or hand over",
  office: "Dalhin sa opisina · Bring to the office",
}
