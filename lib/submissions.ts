// How a filed return or application moves through the agency.
// ponytail: DEMO tracking. Agencies aren't connected, so each step's time is
// derived from when it was filed; replace with the agency's status API.

export type SubmissionKind = "return" | "application"

export type Submission = {
  refNo: string
  kind: SubmissionKind
  title: string
  agency: string
  formId: string | null
  requirementId: string | null
  period: string | null
  paymentTxnid: string | null
  demo: boolean
  createdAt: string
}

const FLOW: Record<SubmissionKind, { label: string; after: number }[]> = {
  return: [
    { label: "Filed", after: 0 },
    { label: "Received by BIR", after: 20_000 },
    { label: "Payment matched", after: 60_000 },
    { label: "Accepted", after: 120_000 },
  ],
  application: [
    { label: "Submitted", after: 0 },
    { label: "Received by the office", after: 20_000 },
    { label: "Documents under review", after: 60_000 },
    { label: "Assessment and inspection", after: 180_000 },
    { label: "Approved: ready to claim", after: 300_000 },
  ],
}

export function track(kind: SubmissionKind, createdAt: string, now = Date.now()) {
  const age = now - Date.parse(createdAt)
  // The first step is done the moment it's filed, even if this device's clock is behind the server's.
  const steps = FLOW[kind].map((s) => ({ label: s.label, done: s.after === 0 || age >= s.after, at: new Date(Date.parse(createdAt) + s.after).toISOString() }))
  const current = steps.filter((s) => s.done).at(-1)!
  return { steps, status: current.label, finished: steps.every((s) => s.done) }
}

export const newRefNo = (kind: SubmissionKind, random: string) =>
  `${kind === "return" ? "RTN" : "APP"}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${random.toUpperCase()}`
