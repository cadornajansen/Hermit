"use server"

import { egov, isLive, serviceModes } from "@/lib/egov"
import { buildChecklist, EMPTY_PROFILE } from "@/lib/engine"
import { clearSession, readSession } from "@/lib/session"
import type { Profile, Requirement } from "@/lib/types"

// Server Functions are public POST endpoints: validate every input here.
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export async function classifyBusiness(description: string) {
  const d = text(description, 500)
  if (!d) return null
  return egov("ai").classify(d)
}

// --- Kuya Hermit ------------------------------------------------------------
// Retrieval-grounded: the engine picks which requirements are relevant; the
// model (eGov AI when live) only rewrites those facts in plain Taglish.

const STOP = new Set(["ang", "ako", "ano", "mga", "the", "and", "for", "what", "how", "need", "kailangan", "paano", "do", "ba", "ko", "ng", "sa", "na"])

function score(r: Requirement, words: string[]) {
  const hay = `${r.id} ${r.name} ${r.agency} ${r.explainer} ${r.documents.join(" ")} ${r.formIds.join(" ")}`.toLowerCase()
  return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0)
}

function facts(r: Requirement) {
  return [
    `**${r.name}** (${r.agency})`,
    r.explainer,
    `Dalhin / what to bring: ${r.documents.join("; ")}`,
    `Bayad / fee: ${r.fee}`,
    `Saan / where: ${r.whereToFile}`,
    `Gaano katagal / processing: ${r.processingTime}`,
    `Renewal: ${r.renewal}`,
  ].join("\n")
}

export async function askHermit(question: string, clientProfile: Profile) {
  const q = text(question, 500)
  if (!q) return null
  const profile = { ...EMPTY_PROFILE, ...clientProfile, flags: { ...clientProfile?.flags } }
  const words = q.toLowerCase().split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w))
  const matches = buildChecklist(profile, {})
    .map((r) => ({ r, s: score(r, words) }))
    .filter((m) => m.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map((m) => m.r)

  if (!matches.length) {
    return {
      answer:
        "Pasensya, hindi ako sigurado diyan. Para hindi tayo magkamali, magtanong sa pinakamalapit na DTI Negosyo Center o sa RDO mo. (I only answer from official sources I've indexed.)",
      sources: [],
      formIds: [],
    }
  }

  const context = matches.map(facts).join("\n\n")
  let answer: string
  try {
    answer = await egov("ai").explain(q, context)
  } catch (e) {
    console.error("eGov AI explain failed; showing grounded facts", e)
    answer = context
  }
  return {
    answer: `${answer}\n\n_Hindi ito legal o tax advice. Not legal or tax advice._`,
    sources: matches.map((r) => ({ name: r.name, url: r.sourceUrl, lastVerified: r.lastVerified })),
    formIds: [...new Set(matches.flatMap((r) => r.formIds))],
  }
}

// --- eMessage ---------------------------------------------------------------

const PH_MOBILE = /^\+639\d{9}$/

export async function sendReminderSms(input: { title: string; due: string; mobile: string }) {
  const title = text(input.title, 80)
  const due = text(input.due, 10)
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: "Invalid reminder" }

  // Live SMS goes only to the verified owner's own number, never a typed one.
  let mobile = text(input.mobile, 20)
  if (isLive("emessage")) {
    const s = await readSession()
    if (!s?.verified) return { ok: false, error: "Sign in with eGovPH to get SMS reminders" }
    mobile = s.identity.mobile
  }
  if (!PH_MOBILE.test(mobile)) return { ok: false, error: "Use a PH mobile number like +639171234567" }

  try {
    await egov("emessage").sendSms(mobile, `HERMIT: Paalala — "${title}" due on ${due}. Open HERMIT for your pre-filled form and office.`)
    return { ok: true }
  } catch (e) {
    console.error("eMessage failed", e)
    return { ok: false, error: "SMS failed, try again later" }
  }
}

// --- eReport ----------------------------------------------------------------

export async function reportProblem(input: { office: string; message: string }) {
  const office = text(input.office, 120)
  const message = text(input.message, 2000)
  if (!office || !message) return { ok: false, error: "Please describe the problem" }
  const s = await readSession()
  if (isLive("report") && !s?.verified) return { ok: false, error: "Sign in with eGovPH to file a report" }
  try {
    const { caseNumber } = await egov("report").submit({
      identity: s?.identity ?? ({} as never),
      subject: `Red tape at ${office}`,
      message,
      reportType: process.env.EGOV_EREPORT_REPORT_TYPE ?? "",
    })
    return { ok: true, caseNumber }
  } catch (e) {
    console.error("eReport failed", e)
    return { ok: false, error: "Report failed, try again later" }
  }
}

// --- Session ----------------------------------------------------------------

export async function signOut() {
  await clearSession()
}

export async function integrationStatus() {
  return serviceModes()
}
