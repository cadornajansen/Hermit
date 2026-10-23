// The exact documents one owner needs for one requirement, from their own
// answers, and the questions to ask first when an unknown answer would change
// the list. Kuya Hermit uses this before telling anyone what to bring.
import { getRequirement } from "./engine.ts"
import type { DocType, Profile } from "./types"

export type DocItem = { name: string; detail?: string; vault?: DocType }
export type AskFirst = { field: keyof Profile; question: string }

const ASK: Partial<Record<keyof Profile, string>> = {
  structure: "Ikaw lang ba ang may-ari, o may kasosyo / corporation ba? · Are you the sole owner, or a partnership / corporation?",
  premises: "Ang puwesto ba ay nirerentahan, sarili mo, o sa bahay mo? · Is the place rented, owned, or your home?",
  employees: "May empleyado ka ba, at ilan? · Do you have employees, and how many?",
  category: "Ano ang ibinebenta o ginagawa ng negosyo mo? · What does your business sell or do?",
  taxOption: "8% flat tax ba o graduated rates ang pipiliin mo? · Will you take the 8% option or graduated rates?",
}

const registrationDoc = (p: Profile): DocItem =>
  p.structure === "partnership" || p.structure === "corporation"
    ? { name: "SEC Certificate of Registration", detail: "plus Articles of Partnership / Incorporation", vault: "sec_cert" }
    : p.structure === "cooperative"
      ? { name: "CDA Certificate of Registration", vault: "cda_cert" }
      : { name: "DTI Business Name Certificate", detail: `in the name of ${p.ownerName || "the owner"}`, vault: "dti_cert" }

const premisesDoc = (p: Profile): DocItem | null =>
  p.premises === "rented"
    ? { name: "Contract of lease", detail: "notarized, with a copy of the lessor's valid ID", vault: "lease" }
    : p.premises === "owned"
      ? { name: "Land title (TCT) or tax declaration", detail: "in your name", vault: "lease" }
      : p.premises === "home"
        ? { name: "Proof the place is yours, or the owner's consent", detail: "TCT / tax declaration, or a signed consent letter from the property owner (HERMIT can prepare it)", vault: "lease" }
        : null

const idDoc = (p: Profile): DocItem => ({
  name: "Valid government ID",
  detail: p.identityVerified ? "your National ID is already verified in HERMIT" : "PhilSys National ID, UMID, passport or driver's license",
  vault: "valid_id",
})

const foodHandlers = (p: Profile): DocItem | null =>
  p.category === "food_service" || p.category === "packaged_food" || p.flags.food === true
    ? {
        name: "Health certificates",
        detail: p.employees === "none" ? "for you" : "for you and every staff member who handles food",
        vault: "health_cert",
      }
    : null

export function documentsFor(requirementId: string, p: Profile): { items: DocItem[]; askFirst: AskFirst[] } | null {
  const r = getRequirement(requirementId)
  if (!r) return null
  const ask = (fields: (keyof Profile)[]): AskFirst[] =>
    fields.filter((f) => p[f] === "unknown").map((field) => ({ field, question: ASK[field]! }))
  const list = (items: (DocItem | null | false)[]) => items.filter((x): x is DocItem => Boolean(x))
  const taguig = /taguig/i.test(p.city)

  switch (requirementId) {
    case "dti_bn":
      return { items: list([idDoc(p), { name: "Proposed business name", detail: "plus two alternates in case it's taken" }]), askFirst: ask(["structure"]) }
    case "brgy_clearance":
      return {
        items: list([registrationDoc(p), premisesDoc(p), { name: "Community Tax Certificate (cedula)", detail: `for ${new Date().getFullYear()}`, vault: "cedula" }, idDoc(p)]),
        askFirst: ask(["structure", "premises"]),
      }
    case "mayors_permit":
      return {
        items: list([
          { name: taguig ? "Taguig Unified Business Permit Application Form" : "Unified business permit application form", detail: "HERMIT fills it from your profile" },
          registrationDoc(p),
          { name: "Barangay Business Clearance", detail: "for this year", vault: "brgy_clearance" },
          premisesDoc(p),
          { name: "Community Tax Certificate (cedula)", vault: "cedula" },
          p.structure === "corporation" || p.structure === "partnership" ? { name: "Secretary's certificate or board resolution", detail: "naming who files for the company" } : false,
          foodHandlers(p) && { name: "Sanitary permit", detail: "the city health office issues it; health certificates come first", vault: "sanitary_permit" },
          { name: "Locational / zoning clearance and fire safety (FSIC)", detail: "usually processed together at the city's e-BOSS" },
          taguig && { name: "Taguig's additional requirements list", detail: "check the official list in Forms for your line of business" },
        ]),
        askFirst: ask(["structure", "premises", "category"]),
      }
    case "bir_cor":
      return {
        items: list([
          p.structure === "sole" || p.structure === "unknown"
            ? { name: "BIR Form 1901", detail: `HERMIT fills it; it records your ${p.taxOption === "8pct" ? "8% option" : p.taxOption === "graduated" ? "graduated-rate choice" : "income tax choice"}` }
            : { name: "BIR Form 1903", detail: "HERMIT fills it" },
          idDoc(p),
          registrationDoc(p),
          { name: "Mayor's permit or proof that you applied", vault: "mayors_permit" },
          premisesDoc(p),
        ]),
        askFirst: ask(["structure", "premises", "taxOption"]),
      }
    case "sanitary_permit":
      return { items: list([foodHandlers(p) ?? { name: "Health certificates", detail: "for everyone who handles food", vault: "health_cert" }, registrationDoc(p)]), askFirst: ask(["employees"]) }
    case "sss_er":
    case "philhealth_er":
    case "pagibig_er":
      return {
        items: list([
          { name: requirementId === "sss_er" ? "SSS Form R-1 (employer registration)" : requirementId === "philhealth_er" ? "PhilHealth ER1" : "Pag-IBIG employer registration form", detail: "HERMIT fills it" },
          requirementId === "sss_er" && { name: "SSS Form R-1A", detail: "lists each employee you're reporting" },
          { name: "Mayor's / Business Permit", vault: "mayors_permit" },
          registrationDoc(p),
          idDoc(p),
        ]),
        askFirst: ask(["employees", "structure"]),
      }
    default:
      return { items: r.documents.map((name): DocItem => ({ name })), askFirst: ask(["structure"]) }
  }
}
