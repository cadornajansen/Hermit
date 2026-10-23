// Exactly where to START each process, for steps that are done online or at
// an office rather than with a downloadable form. Every URL was opened and the
// path clicked through on the date below; `note` says when a site blocked or
// failed the check. ponytail: re-verify by hand (or add a link checker to
// pnpm forms:sync) when a portal changes.
import { filingTask, type FilingTask } from "./forms.ts"
import { jurisdictionLabel, resolveLocation, type LocationValue } from "./locations.ts"

export type StartLink = { label: string; url: string; steps: string[] }
export type Process = { links: StartLink[]; office?: string; verifiedOn: string; note?: string; jurisdiction?: string }

const ORUS = "https://orus.bir.gov.ph/home"
const PBH_SIGNUP = "https://business.gov.ph/signup"
const TLC = "https://tlcportal.taguig.gov.ph/register"
const CHECKED = "2026-10-22"

export const PROCESSES: Record<string, Process> = {
  dti_bn: {
    links: [{ label: "DTI Business Name Registration System (BNRS)", url: "https://bnrs.dti.gov.ph", steps: ["Open BNRS and choose the new business name registration", "Search that your name is available, then fill in owner details and pay online"] }],
    verifiedOn: CHECKED,
    note: "BNRS was intermittently down (HTTP 500/504) when checked; try again later or go to a DTI Negosyo Center.",
  },
  sec_reg: {
    links: [
      { label: "SEC eSPARC — Regular processing", url: "https://esparc.sec.gov.ph/application/select-regular", steps: ["Choose the company type", "Reserve the company name, then fill in the registration application"] },
      { label: "SEC eSPARC — OneSEC (one-day e-registration)", url: "https://esparc.sec.gov.ph/application/select-one-sec", steps: ["For standard corporations using the SEC's model articles and by-laws"] },
      { label: "Or register everything via the Philippine Business Hub", url: PBH_SIGNUP, steps: ["Create an account and verify your email", "Log in at business.gov.ph/login → Register a Business"] },
    ],
    verifiedOn: CHECKED,
  },
  cda_reg: {
    links: [{ label: "CDA Cooperative Registration (online)", url: "https://cs.cda.gov.ph/users/login", steps: ["Create an account / log in", "Start a new cooperative registration and upload the pro-forma documents"] }],
    verifiedOn: CHECKED,
  },
  brgy_clearance: {
    links: [],
    office: "Your barangay hall (bring your DTI/SEC certificate, lease or title, cedula and a valid ID)",
    verifiedOn: CHECKED,
  },
  brgy_renewal: { links: [], office: "Your barangay hall, before renewing the Mayor's Permit in January", verifiedOn: CHECKED },
  mayors_permit: {
    links: [],
    office: "Your city / municipal hall BPLO or e-BOSS",
    note: "Confirm the correct new-permit portal and requirements with your LGU; no portal is verified here for this jurisdiction and task.",
    verifiedOn: CHECKED,
  },
  mayors_renewal: {
    links: [],
    office: "Your city / municipal hall BPLO (renewal)",
    note: "Confirm your LGU's renewal portal and deadline.",
    verifiedOn: CHECKED,
  },
  fsic: {
    links: [{ label: "BFP Fire Safety Information System (FSIS)", url: "https://fsis.e-bfp.com/register", steps: ["Register an FSIS account", "Apply for the Fire Safety Inspection Certificate and pay the fire fee"] }],
    office: "BFP desk at your city's e-BOSS",
    verifiedOn: CHECKED,
    note: "FSIS is on fsis.e-bfp.com (not a .gov.ph domain); it is the address published by city governments (e.g. Davao, Loon). Confirm with your city's BFP station.",
  },
  sanitary_permit: { links: [], office: "Your city / municipal health office", verifiedOn: CHECKED },
  health_certs: { links: [], office: "City health office — each food handler applies in person", verifiedOn: CHECKED },
  cenro: { links: [], office: "City ENRO desk at the city hall e-BOSS", verifiedOn: CHECKED },
  liquor_license: { links: [], office: "City hall BPLO (after the Mayor's Permit)", verifiedOn: CHECKED },
  bir_cor: {
    links: [
      { label: "BIR ORUS — New Registration (sole proprietor / professional)", url: ORUS, steps: ["Click “New Registration”", "Choose “As An Individual”", "Fill in BIR Form 1901 online and upload your ID"] },
      { label: "BIR ORUS — New Registration (corporation / partnership / OPC)", url: ORUS, steps: ["Click “New Registration”", "Choose “As a Non-Individual” (BIR Form 1903)"] },
    ],
    office: "Or file at your RDO (see Offices)",
    verifiedOn: CHECKED,
  },
  bir_books: {
    links: [{ label: "BIR ORUS — log in to register books", url: ORUS, steps: ["Click “LOGIN” (use the account from your ORUS registration)", "Open the books of accounts registration and choose manual, loose-leaf or computerized"] }],
    verifiedOn: CHECKED,
  },
  bir_invoices: {
    links: [{ label: "BIR ORUS — log in for invoices / Authority to Print", url: ORUS, steps: ["Click “LOGIN”", "Apply for Authority to Print (BIR Form 1906) or register your invoices"] }],
    verifiedOn: CHECKED,
  },
  tax_option: {
    links: [{ label: "BIR eBIRForms (file 1701Q and elect 8%)", url: "https://www.bir.gov.ph/ebirforms", steps: ["Download the eBIRForms package", "Open BIR Form 1701Q for your first quarter and tick the 8% option"] }],
    verifiedOn: CHECKED,
  },
  bmbe: {
    links: [{ label: "DTI BMBE Online Registration", url: "https://bmbe-registration.dti.gov.ph/undertaking", steps: ["Read and accept the Undertaking", "Fill in your business and asset details; the Certificate of Authority is free"] }],
    office: "Or any DTI Negosyo Center",
    verifiedOn: CHECKED,
  },
  fda_lto: {
    links: [
      { label: "FDA eServices — create an account", url: "https://eservices.fda.gov.ph/account_registration", steps: ["Register your establishment's account"] },
      { label: "FDA eServices — apply for a License to Operate", url: "https://eservices.fda.gov.ph/applications", steps: ["Log in", "Choose “License to Operate”"] },
    ],
    verifiedOn: CHECKED,
  },
  fda_cpr: {
    links: [{ label: "FDA eServices — Certificate of Product Registration", url: "https://eservices.fda.gov.ph/applications", steps: ["Log in", "Choose “Certificate of Product Registration”, one application per product"] }],
    verifiedOn: CHECKED,
  },
  sss_er: {
    links: [
      { label: "Register as an employer via the Philippine Business Hub", url: PBH_SIGNUP, steps: ["SSS now takes new employer registrations through the Business Hub", "Create an account → log in → Register a Business"] },
      { label: "Then open My.SSS for employers", url: "https://employer.sss.gov.ph/employer/?logtype=er", steps: ["Click “Create account” and choose “Employer”", "Fill in the Employer Information exactly as registered, then confirm via email"] },
    ],
    verifiedOn: CHECKED,
  },
  philhealth_er: {
    links: [
      { label: "Register via the Philippine Business Hub", url: PBH_SIGNUP, steps: ["Registering through the Business Hub means no separate documents for PhilHealth"] },
      { label: "PhilHealth employer registration requirements", url: "https://www.philhealth.gov.ph/partners/employers/registration.php", steps: ["If not via the Hub: submit ER1 (in duplicate) and a PMRF for each employee at any PhilHealth office"] },
    ],
    verifiedOn: CHECKED,
  },
  pagibig_er: {
    links: [{ label: "Register via the Philippine Business Hub", url: PBH_SIGNUP, steps: ["Create an account → log in → Register a Business, and include Pag-IBIG"] }],
    office: "Or any Pag-IBIG branch with the Employer's Data Form",
    verifiedOn: CHECKED,
    note: "Pag-IBIG's own website and Virtual Pag-IBIG were behind a bot check / unavailable when checked.",
  },
  dole_1020: {
    links: [{ label: "DOLE Online Compliance Portal (Rule 1020 registration)", url: "https://reports.dole.gov.ph", steps: ["Create an establishment account", "Submit the Rule 1020 establishment registration"] }],
    office: "Or your DOLE field office",
    verifiedOn: CHECKED,
    note: "The portal shows a security check before loading; complete it in your browser.",
  },
  withholding_comp: {
    links: [
      { label: "BIR eFPS (electronic filing and payment)", url: "https://efps.bir.gov.ph", steps: ["Enroll, then file BIR Form 1601-C every month"] },
      { label: "Or BIR eBIRForms", url: "https://www.bir.gov.ph/ebirforms", steps: ["Download eBIRForms and file 1601-C / 1604-C"] },
    ],
    verifiedOn: CHECKED,
  },
  regulated_review: { links: [], office: "Your nearest DTI Negosyo Center", verifiedOn: CHECKED },
}

// Local portal entries are keyed by canonical PSGC jurisdiction and filing task.
const LOCAL_PROCESSES: Record<string, Record<string, Partial<Record<FilingTask, Process>>>> = {
  "1381500000": {
    mayors_permit: { new: {
      links: [
        { label: "Taguig TLC Portal — Business Permit", url: TLC, steps: ["Register a TLC Portal account, then log in", "On Home, tap “Apply for Business Permit”", "Upload your requirements (DTI/SEC, barangay clearance, lease, cedula)"] },
        { label: "Check a Taguig permit's status", url: "https://verifybusiness.taguig.gov.ph", steps: ["Verify an issued business permit"] },
      ],
      office: "Taguig City Hall BPLO / e-BOSS",
      verifiedOn: CHECKED,
    } },
    mayors_renewal: { renewal: {
      links: [{ label: "Taguig TLC Portal — Business Permit renewal", url: TLC, steps: ["Log in to the TLC Portal", "On Home, tap “Apply for Business Permit” and choose renewal", "Declare last year's gross sales"] }],
      office: "Taguig City Hall BPLO (January, before the deadline)",
      verifiedOn: CHECKED,
    } },
  },
}

export function processFor(requirementId: string, location?: LocationValue, task = filingTask(requirementId)): Process | undefined {
  const canonical = location && resolveLocation(location)
  const local = canonical?.city && LOCAL_PROCESSES[canonical.city.code]?.[requirementId]?.[task]
  let process = local || PROCESSES[requirementId]
  if (!process) return undefined
  if (requirementId === "bir_cor" && task !== "new") {
    process = task === "update"
      ? { links: [{ label: "BIR ORUS — registration update / cancellation", url: ORUS, steps: ["Confirm the update / cancellation process with your RDO (Form 1905)"] }], verifiedOn: CHECKED }
      : { links: [], office: "Your BIR RDO — confirm eligibility and the abatement process (Form 2121)", verifiedOn: CHECKED }
  }
  if (requirementId === "dti_bn" && task === "renewal") process = { ...process, links: [{ label: "DTI BNRS — Renewal", url: "https://bnrs.dti.gov.ph", steps: ["Choose Business Name Renewal and confirm your registration details"] }] }
  return { ...process, jurisdiction: location ? jurisdictionLabel(location) : "Confirm your business jurisdiction" }
}
