// What the payment terminal can pay, and the return periods each one takes.
// Amounts are always the owner's own figure from their return: HERMIT never
// computes tax due (PRD non-goal).

export type Payable = {
  formId: string // lib/forms.ts id, for the filled return
  code: string
  label: string
  period: "quarter" | "month" | "year"
  deadlineId?: string // lib/engine.ts deadline rule, to surface what's due
}

export const PAYABLES: Payable[] = [
  { formId: "bir_2551q", code: "2551Q", label: "Quarterly percentage tax", period: "quarter", deadlineId: "2551q" },
  { formId: "bir_1701q", code: "1701Q", label: "Quarterly income tax (individuals)", period: "quarter", deadlineId: "1701q" },
  { formId: "bir_2550q", code: "2550Q", label: "Quarterly VAT", period: "quarter", deadlineId: "2550q" },
  { formId: "bir_1701", code: "1701 / 1701A", label: "Annual income tax (individuals)", period: "year", deadlineId: "annual_itr" },
  { formId: "bir_1702q", code: "1702Q", label: "Quarterly income tax (corporations)", period: "quarter", deadlineId: "1702q" },
  { formId: "bir_1702", code: "1702", label: "Annual income tax (corporations)", period: "year" },
  { formId: "bir_1601c", code: "1601-C", label: "Withholding tax on compensation", period: "month", deadlineId: "1601c" },
  { formId: "bir_0619e", code: "0619-E", label: "Expanded withholding (monthly)", period: "month" },
  { formId: "bir_1601eq", code: "1601-EQ", label: "Expanded withholding (quarterly)", period: "quarter" },
  { formId: "bir_0605", code: "0605", label: "Payment form (registration DST, penalties, other BIR fees)", period: "year" },
]

export const getPayable = (formId: string) => PAYABLES.find((p) => p.formId === formId)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// Most recent completed periods first (the ones a return is filed for now).
export function periodsFor(kind: Payable["period"], today = new Date()) {
  const y = today.getFullYear()
  const m = today.getMonth()
  if (kind === "year") return [y - 1, y - 2, y].map((v) => ({ value: `${v}`, label: `Taxable year ${v}` }))
  if (kind === "month")
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(y, m - 1 - i, 1)
      return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
    })
  const q = Math.floor(m / 3) // current quarter index; the last completed one is q-1
  return Array.from({ length: 4 }, (_, i) => {
    let qi = q - 1 - i
    let yr = y
    while (qi < 0) {
      qi += 4
      yr--
    }
    return { value: `${yr}-Q${qi + 1}`, label: `Q${qi + 1} ${yr} (${MONTHS[qi * 3]}–${MONTHS[qi * 3 + 2]})` }
  })
}

export const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// "1,234.5" → 1234.5; rejects anything that isn't a positive peso amount.
export function parseAmount(s: string) {
  const v = Number(String(s).replace(/[₱,\s]/g, ""))
  return Number.isFinite(v) && v > 0 && v <= 50_000_000 && Math.round(v * 100) === v * 100 ? v : null
}
