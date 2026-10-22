"use server"

import { egov, isLive, serviceModes } from "@/lib/egov"
import { BUCKET, db } from "@/lib/db"
import { buildChecklist, EMPTY_PROFILE } from "@/lib/engine"
import { mock } from "@/lib/egov/mock"
import { formsFor } from "@/lib/forms"
import {
  askKuyaHermit,
  classifyWithHermit,
  extractPdfWithHermit,
  HERMIT_MODEL,
  hermitEnabled,
  type HermitContext,
  type HermitReply,
} from "@/lib/hermit"
import { takeAiQuota } from "@/lib/ratelimit"
import { ownerId, readSession, writeSession } from "@/lib/session"
import type { Extracted, Profile, Requirement } from "@/lib/types"

// Server Functions are public POST endpoints: validate every input here.
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export async function classifyBusiness(description: string) {
  const d = text(description, 500)
  if (!d) return null
  const usesAi = hermitEnabled() || isLive("ai")
  if (usesAi && !(await takeAiQuota("classify"))) return mock.ai.classify(d)
  if (hermitEnabled()) {
    try {
      return await classifyWithHermit(d)
    } catch (e) {
      console.error("Kuya Hermit classify failed; falling back", e)
    }
  }
  return egov("ai").classify(d)
}

// --- Kuya Hermit ------------------------------------------------------------
// With ASSEMBLYAI_API_KEY set, Kuya Hermit is an LLM with tools over the rules
// engine, forms catalog and the owner's records (lib/hermit.ts). Without it,
// a keyword retrieval over the rules table answers instead.

const STOP = new Set(["ang", "ako", "ano", "mga", "the", "and", "for", "what", "how", "need", "kailangan", "paano", "do", "ba", "ko", "ng", "sa", "na"])

function score(r: Requirement, words: string[]) {
  const hay = `${r.id} ${r.name} ${r.agency} ${r.explainer} ${r.documents.join(" ")}`.toLowerCase()
  return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0)
}

function facts(r: Requirement) {
  return [
    `${r.name} (${r.agency})`,
    r.explainer,
    `Dalhin / what to bring: ${r.documents.join("; ")}`,
    `Bayad / fee: ${r.fee}`,
    `Saan / where: ${r.whereToFile}`,
    `Gaano katagal / processing: ${r.processingTime}`,
    `Renewal: ${r.renewal}`,
  ].join("\n")
}

function keywordAnswer(q: string, profile: Profile): HermitReply {
  const words = q.toLowerCase().split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w))
  const matches = buildChecklist(profile, {})
    .map((r) => ({ r, s: score(r, words) }))
    .filter((m) => m.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map((m) => m.r)
  if (!matches.length)
    return {
      answer: "Pasensya, hindi ako sigurado diyan. Para hindi tayo magkamali, magtanong sa pinakamalapit na DTI Negosyo Center o sa RDO mo.",
      sources: [],
      formIds: [],
      saved: {},
    }
  return {
    answer: matches.map(facts).join("\n\n"),
    sources: matches.map((r) => ({ name: r.name, url: r.sourceUrl, lastVerified: r.lastVerified })),
    formIds: [...new Set(matches.flatMap((r) => formsFor(r.id, profile).map((f) => f.id)))].slice(0, 3),
    saved: {},
  }
}

export async function askHermit(input: {
  question: string
  history: { role: "owner" | "hermit"; text: string }[]
  profile: Profile
  items: HermitContext["items"]
  docs: HermitContext["docs"]
}): Promise<HermitReply | null> {
  const q = text(input?.question, 1000)
  if (!q) return null
  const profile = { ...EMPTY_PROFILE, ...input.profile, flags: { ...input.profile?.flags }, extra: { ...input.profile?.extra } }
  const history = (Array.isArray(input.history) ? input.history : [])
    .slice(-10)
    .map((m) => ({ role: m?.role === "owner" ? ("owner" as const) : ("hermit" as const), text: text(m?.text, 2000) }))
    .filter((m) => m.text)
  const ctx: HermitContext = {
    profile,
    items: input.items && typeof input.items === "object" ? input.items : {},
    docs: (Array.isArray(input.docs) ? input.docs : []).slice(0, 100),
  }

  let reply: HermitReply
  if (hermitEnabled() && !(await takeAiQuota("chat"))) {
    reply = {
      answer:
        profile.lang === "en"
          ? "You've reached Kuya Hermit's question limit for now. Please try again in about an hour. Your checklist, forms and calendar still work in the meantime."
          : "Pasensya, naabot mo na ang limit ng tanong kay Kuya Hermit sa ngayon. Subukan ulit pagkalipas ng mga isang oras. Gumagana pa rin ang checklist, forms at kalendaryo mo.",
      sources: [],
      formIds: [],
      saved: {},
    }
  } else if (hermitEnabled()) {
    try {
      reply = await askKuyaHermit(q, history, ctx)
    } catch (e) {
      console.error("Kuya Hermit failed; using keyword answer", e)
      reply = keywordAnswer(q, profile)
    }
  } else reply = keywordAnswer(q, profile)

  // Conversation memory on the server (deletable from the Profile page).
  const sb = db()
  const id = sb && (await ownerId(true))
  if (sb && id) {
    await sb.from("owners").upsert({ id }, { onConflict: "id", ignoreDuplicates: true })
    await sb.from("chat_messages").insert([
      { owner_id: id, role: "owner", text: q },
      { owner_id: id, role: "hermit", text: reply.answer, sources: reply.sources, form_ids: reply.formIds, packs: reply.packs?.length ? reply.packs : null },
    ])
  }
  return reply
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

export async function integrationStatus() {
  return {
    ...serviceModes(),
    "kuya hermit": hermitEnabled() ? `live · ${HERMIT_MODEL}` : "keyword fallback",
    "face liveness": process.env.NEXT_PUBLIC_EGOV_LIVENESS_PUBKEY ? "live (eVerify SDK)" : "mock",
    database: db() ? "supabase" : "device only",
  }
}

// --- Document vault ---------------------------------------------------------

const MAX_UPLOAD = 10 * 1024 * 1024
const UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]

// Stores the file (Supabase Storage, when on) and has the AI read it.
// lib/vault.ts then decides on the device whether it's the right document.
export async function readDocument(formData: FormData) {
  const file = formData.get("file")
  const docId = String(formData.get("id") ?? "")
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Walang file" }
  if (file.size > MAX_UPLOAD) return { ok: false as const, error: "Masyadong malaki — hanggang 10MB lang" }
  if (!UPLOAD_TYPES.includes(file.type)) return { ok: false as const, error: "PDF o larawan (JPG, PNG) lang" }
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return { ok: false as const, error: "Invalid document id" }

  let storagePath: string | undefined
  const sb = db()
  const id = sb && (await ownerId(true))
  if (sb && id) {
    await sb.from("owners").upsert({ id }, { onConflict: "id", ignoreDuplicates: true })
    const up = await sb.storage.from(BUCKET).upload(`${id}/${docId}`, file, { contentType: file.type, upsert: false })
    if (up.error) console.error("Storage upload failed; keeping the file on the device only", up.error)
    else storagePath = `${id}/${docId}`
  }

  const done = (extracted: Extracted, reader: string | null, limited = false) =>
    ({ ok: true as const, extracted, reader, storagePath, limited })
  const usesAi = (hermitEnabled() && file.type === "application/pdf") || isLive("ai")
  if (usesAi && !(await takeAiQuota("read"))) return done(await mock.ai.extractDocument(file), null, true)
  try {
    if (hermitEnabled() && file.type === "application/pdf") {
      const extracted = await extractPdfWithHermit(file)
      if (extracted) return done(extracted, "Kuya Hermit")
    }
    if (isLive("ai")) return done(await egov("ai").extractDocument(file), "eGov AI")
  } catch (e) {
    console.error("Document reading failed; falling back to filename", e)
  }
  return done(await mock.ai.extractDocument(file), null)
}

// --- National ID (PhilSys) verification -------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const LIVENESS_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The browser runs eVerify's face-liveness SDK and sends us its session id;
// we match it with the owner's name + birthday against PhilSys. If they came
// in through eGovPH SSO, the eGovPH name and birthday are used, not typed ones.
export async function verifyNationalId(input: {
  sessionId: string
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string
  birthDate?: string
}) {
  const sessionId = text(input?.sessionId, 64)
  const live = isLive("everify")
  if (live ? !LIVENESS_ID.test(sessionId) : !sessionId) return { ok: false as const, error: "Hindi natapos ang face scan. Subukan ulit." }

  const session = await readSession()
  const sso = session?.identity?.uniqid ? session.identity : null
  const person = sso
    ? { firstName: sso.firstName, middleName: sso.middleName, lastName: sso.lastName, suffix: sso.suffix ?? "", birthDate: sso.birthDate }
    : {
        firstName: text(input.firstName, 80),
        middleName: text(input.middleName, 80),
        lastName: text(input.lastName, 80),
        suffix: text(input.suffix, 10),
        birthDate: text(input.birthDate, 10),
      }
  if (!person.firstName || !person.lastName || !ISO_DATE.test(person.birthDate))
    return { ok: false as const, error: "Kailangan ang pangalan (first at last) at kaarawan na nasa National ID mo." }
  if (live && !(await takeAiQuota("verify")))
    return { ok: false as const, error: "Masyadong maraming subok. Subukan ulit pagkalipas ng isang oras." }

  let result
  try {
    result = await egov("everify").verify(person, sessionId)
  } catch (e) {
    // egov.js throws the parsed error body; a bad/expired liveness session is the owner's to retry.
    if ((e as { error?: string })?.error === "face_liveness_error_exception")
      return { ok: false as const, error: "Hindi natapos o nag-expire ang face scan. Subukan ulit." }
    console.error("eVerify failed", e)
    return { ok: false as const, error: "Hindi ma-reach ang eVerify ngayon. Subukan ulit mamaya." }
  }
  if (!result.verified)
    return { ok: false as const, error: "Hindi tugma sa National ID ang mukha o detalye. Siguraduhing tama ang pangalan at kaarawan, at subukan ulit." }

  const base = session?.identity ?? {
    uniqid: "", firstName: "", middleName: "", lastName: "", suffix: "", birthDate: "", address: "", barangay: "", municipality: "",
    mobile: "", email: "", gender: "", regionCode: "", provinceCode: "", municipalityCode: "", barangayCode: "",
  }
  const identity = { ...base, ...person, ...result.identity }
  await writeSession({ identity, verified: true })

  const sb = db()
  const id = sb && (await ownerId(true))
  if (sb && id) await sb.from("owners").upsert({ id, identity_verified_at: new Date().toISOString() }, { onConflict: "id" })

  const fullName = [identity.firstName, identity.middleName, identity.lastName, identity.suffix].filter(Boolean).join(" ")
  return {
    ok: true as const,
    profile: {
      ownerName: titleCase(fullName),
      birthDate: identity.birthDate,
      homeAddress: identity.address,
      identityVerified: true,
      ...(identity.mobile ? { mobile: identity.mobile } : {}),
      ...(identity.email ? { email: identity.email } : {}),
    },
  }
}

// PhilSys returns names in capitals; the profile keeps them readable.
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
