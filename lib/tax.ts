// Estimated tax due for the returns the payment terminal handles, from the
// owner's own figures. An estimate to fill the return and the amount to pay,
// not tax advice: the owner (or their accountant) confirms before filing.
// Rates: NIRC as amended by TRAIN (RA 10963, graduated table from 2023) and
// CREATE (RA 11534; percentage tax back to 3% from July 1, 2023).

export type TaxInput = {
  gross: number // gross sales/receipts for this quarter (quarterly forms) or the whole year (annual forms)
  grossPrior?: number // earlier quarters of the same year (cumulative quarterly returns)
  paidPrior?: number // income tax already paid for earlier quarters of the same year
  expenses?: number // itemized deductions; leave out to use the 40% optional standard deduction (individuals)
  purchases?: number // VAT-able purchases, before VAT (2550Q)
  smallCorp?: boolean // net taxable income ≤ ₱5M and assets ≤ ₱100M (excl. land) → 20% RCIT
}

export type TaxLine = { label: string; amount: number }
export type TaxResult = { formId: string; method: string; lines: TaxLine[]; due: number; basis: string[]; notes: string[] }

export const COMPUTABLE = ["bir_2551q", "bir_1701q", "bir_1701", "bir_2550q", "bir_1702q", "bir_1702"]

const r2 = (n: number) => Math.round(n * 100) / 100

// TRAIN graduated income tax table for individuals, 2023 onwards (annual taxable income).
export function graduated(taxable: number) {
  const t = Math.max(0, taxable)
  if (t <= 250_000) return 0
  if (t <= 400_000) return 0.15 * (t - 250_000)
  if (t <= 800_000) return 22_500 + 0.2 * (t - 400_000)
  if (t <= 2_000_000) return 102_500 + 0.25 * (t - 800_000)
  if (t <= 8_000_000) return 402_500 + 0.3 * (t - 2_000_000)
  return 2_202_500 + 0.35 * (t - 8_000_000)
}

export function computeTax(formId: string, option: "8pct" | "graduated" | "unknown", input: TaxInput): TaxResult | null {
  const gross = Math.max(0, input.gross || 0)
  const prior = Math.max(0, input.grossPrior || 0)
  const paid = Math.max(0, input.paidPrior || 0)
  const quarterly = formId === "bir_1701q" || formId === "bir_1702q"
  const cumulative = gross + (quarterly ? prior : 0)
  const less = (lines: TaxLine[], taxDue: number) => {
    if (paid) lines.push({ label: quarterly ? "Less: paid in earlier quarters" : "Less: paid in quarterly returns", amount: -paid })
    return Math.max(0, r2(taxDue - paid))
  }

  switch (formId) {
    case "bir_2551q": {
      const due = r2(gross * 0.03)
      return {
        formId,
        method: "Percentage tax, 3% of gross quarterly sales",
        lines: [
          { label: "Gross sales/receipts this quarter", amount: gross },
          { label: "Percentage tax (3%)", amount: due },
        ],
        due,
        basis: ["NIRC Sec. 116 (3% from July 1, 2023, after CREATE's temporary 1%)"],
        notes: ["Not filed if you chose the 8% income tax option or are VAT-registered."],
      }
    }
    case "bir_1701q":
    case "bir_1701": {
      const lines: TaxLine[] = [{ label: quarterly ? "Gross sales/receipts, year to date" : "Gross sales/receipts for the year", amount: cumulative }]
      if (option === "8pct") {
        lines.push({ label: "Less: ₱250,000 exemption", amount: -Math.min(250_000, cumulative) })
        const tax = 0.08 * Math.max(0, cumulative - 250_000)
        lines.push({ label: "Income tax (8%)", amount: r2(tax) })
        return {
          formId,
          method: "8% income tax option",
          lines,
          due: less(lines, tax),
          basis: ["NIRC Sec. 24(A)(2)(b) as amended by TRAIN; RR 8-2018"],
          notes: ["The ₱250,000 exemption applies to purely self-employed owners; mixed-income earners don't deduct it.", "Replaces percentage tax (no 2551Q) for the year."],
        }
      }
      const deduction = input.expenses ?? 0.4 * cumulative
      lines.push({ label: input.expenses === undefined ? "Less: optional standard deduction (40%)" : "Less: itemized deductions", amount: -r2(deduction) })
      const taxable = Math.max(0, cumulative - deduction)
      lines.push({ label: "Taxable income", amount: r2(taxable) })
      const tax = graduated(taxable)
      lines.push({ label: "Income tax (graduated rates)", amount: r2(tax) })
      return {
        formId,
        method: "Graduated income tax rates",
        lines,
        due: less(lines, tax),
        basis: ["NIRC Sec. 24(A)(2)(a), TRAIN table effective 2023", "NIRC Sec. 34(L) optional standard deduction"],
        notes: option === "unknown" ? ["Your profile doesn't say if you chose 8% or graduated; this uses graduated rates."] : [],
      }
    }
    case "bir_2550q": {
      const purchases = Math.max(0, input.purchases || 0)
      const output = 0.12 * gross
      const inputVat = 0.12 * purchases
      const due = Math.max(0, r2(output - inputVat))
      return {
        formId,
        method: "VAT, 12% output tax less input tax",
        lines: [
          { label: "Output VAT (12% of sales)", amount: r2(output) },
          { label: "Less: input VAT (12% of purchases)", amount: -r2(inputVat) },
          { label: "VAT payable", amount: due },
        ],
        due,
        basis: ["NIRC Sec. 106 and 110"],
        notes: ["Amounts are before VAT. Excess input VAT carries over to the next quarter."],
      }
    }
    case "bir_1702q":
    case "bir_1702": {
      const lines: TaxLine[] = [{ label: quarterly ? "Gross income, year to date" : "Gross income for the year", amount: cumulative }]
      const deduction = Math.max(0, input.expenses || 0)
      lines.push({ label: "Less: allowable deductions", amount: -deduction })
      const taxable = Math.max(0, cumulative - deduction)
      const rate = input.smallCorp && taxable <= 5_000_000 ? 0.2 : 0.25
      lines.push({ label: `Income tax (${rate * 100}% RCIT)`, amount: r2(taxable * rate) })
      return {
        formId,
        method: `Regular corporate income tax, ${rate * 100}%`,
        lines,
        due: less(lines, taxable * rate),
        basis: ["NIRC Sec. 27(A) as amended by CREATE"],
        notes: ["Minimum corporate income tax (2% of gross income) may apply from the 4th year of operations."],
      }
    }
    default:
      return null
  }
}
