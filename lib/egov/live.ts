import { createHmac } from "node:crypto"
import {
  createClient,
  eMessage,
  eReport,
  eVerify,
  egovAi,
  egovPay,
  egovSso,
} from "egov.js"

import type { Category, Extracted } from "@/lib/types"
import { DOC_TYPES, EMPTY_EXTRACTED, guessDocType } from "@/lib/vault"
import type { Egov } from "./index"
import { classifyByKeywords } from "./mock"

// Real adapters over the egov.js SDK. Base URLs default to the documented
// hackathon hosts; override with EGOV_<SERVICE>_BASE_URL.
// ponytail: fetches a fresh access token per call; cache it until expires_at
// if quotas or latency start to matter.

const env = (k: string) => process.env[k] ?? ""
const HOSTS = {
  sso: "https://platforms-api.e.gov.ph/egov-sso",
  everify: "https://platforms-api.e.gov.ph/everify",
  emessage: "https://platforms-api.e.gov.ph/emessage",
  ai: "https://platforms-api.e.gov.ph/egov-ai",
  pay: "https://platforms-api.e.gov.ph/egovpay",
  report: "https://platforms-api.e.gov.ph/ereport",
}
const client = (s: keyof typeof HOSTS, headers?: Record<string, string>) =>
  createClient({ baseUrl: env(`EGOV_${s.toUpperCase()}_BASE_URL`) || HOSTS[s], headers })

async function aiToken() {
  const data = await egovAi.generateAccessToken({
    client: client("ai"),
    body: { access_code: env("EGOV_AI_ACCESS_CODE") },
    throwOnError: true,
  })
  return data.access_token
}

async function aiPrompt(prompt: string) {
  const data = await egovAi.generateAssistant({
    client: client("ai"),
    auth: await aiToken(),
    body: { category: "general", prompt },
    throwOnError: true,
  })
  return data.data
}

const CATEGORIES: Category[] = ["retail", "food_service", "packaged_food", "other"]

export const live: Egov = {
  sso: {
    exchange: async (code) => {
      const c = client("sso")
      const tok = await egovSso.generateAccessToken({
        client: c,
        body: {
          exchange_code: code,
          partner_code: env("EGOV_SSO_PARTNER_CODE"),
          partner_secret: env("EGOV_SSO_PARTNER_SECRET"),
          scope: "SSO_AUTHENTICATION",
        },
        throwOnError: true,
      })
      const data = await egovSso.authenticate({ client: c, auth: tok.access_token, throwOnError: true })
      const p = data.data
      return {
        uniqid: p.uniqid ?? "",
        firstName: p.first_name ?? "",
        middleName: p.middle_name ?? "",
        lastName: p.last_name ?? "",
        suffix: p.suffix ?? "",
        birthDate: p.birth_date ?? "",
        address: p.address || [p.street, p.barangay, p.municipality, p.province].filter(Boolean).join(", "),
        barangay: p.barangay ?? "",
        municipality: p.municipality ?? "",
        mobile: p.mobile ?? "",
        email: p.email ?? "",
        gender: p.gender ?? "",
        regionCode: p.region_code ?? "",
        provinceCode: p.province_code ?? "",
        municipalityCode: p.municipality_code ?? "",
        barangayCode: p.barangay_code ?? "",
      }
    },
  },
  everify: {
    verify: async (person, livenessSessionId) => {
      const c = client("everify")
      const auth = await eVerify.authenticate({
        client: c,
        body: { client_id: env("EGOV_EVERIFY_CLIENT_ID"), client_secret: env("EGOV_EVERIFY_CLIENT_SECRET") },
        throwOnError: true,
      })
      const data = await eVerify.verifyPersonalInformation({
        client: c,
        auth: auth.data.access_token,
        body: {
          first_name: person.firstName,
          middle_name: person.middleName || undefined,
          last_name: person.lastName,
          suffix: person.suffix || undefined,
          birth_date: person.birthDate,
          face_liveness_session_id: livenessSessionId,
        },
        throwOnError: true,
      })
      // A failed face match comes back as 200 with { verified: false }.
      if ("verified" in data.data) return { verified: false }
      const d = data.data
      return {
        verified: true,
        identity: {
          firstName: d.first_name,
          middleName: d.middle_name ?? "",
          lastName: d.last_name,
          suffix: d.suffix ?? "",
          birthDate: d.birth_date,
          address: d.present_full_address || d.full_address,
          barangay: d.present_barangay || d.barangay,
          municipality: d.present_municipality || d.municipality,
          gender: d.gender,
          ...(d.mobile_number && d.mobile_number !== "N/A" ? { mobile: `+${d.mobile_number.replace(/^\+/, "")}` } : {}),
          ...(d.email && d.email !== "N/A" ? { email: d.email } : {}),
        },
      }
    },
  },
  emessage: {
    sendSms: async (number, message) => {
      await eMessage.sendSms({
        client: client("emessage", { "X-EMESSAGE-Auth": env("EGOV_EMESSAGE_TOKEN") }),
        body: { number, message },
        throwOnError: true,
      })
    },
  },
  ai: {
    classify: async (description) => {
      const fallback = classifyByKeywords(description)
      try {
        const raw = await aiPrompt(
          `Classify this Philippine micro business. Reply with JSON only: {"category": one of ${JSON.stringify(CATEGORIES)}, "psic": 4-digit PSIC 2009 class code, "label": short English activity name}.\nDescription: ${description}`
        )
        const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))
        return CATEGORIES.includes(parsed.category) ? parsed : fallback
      } catch {
        return fallback
      }
    },
    extractDocument: async (file) => {
      const doc = await egovAi.extractDocument({
        client: client("ai"),
        auth: await aiToken(),
        body: { file },
        throwOnError: true,
      })
      const text = doc.data
      const fallback: Extracted = { ...EMPTY_EXTRACTED, docType: guessDocType(`${file.name} ${text}`), source: "ai" }
      try {
        const raw = await aiPrompt(
          `Read this Philippine business document text and reply with JSON only, using "" for anything not printed on it:\n{"docType": one of ${JSON.stringify(Object.keys(DOC_TYPES))} or "unknown", "ownerName": "", "businessName": "", "address": "", "number": "certificate/registration/ID number", "tin": "", "issuedOn": "YYYY-MM-DD", "expiresOn": "YYYY-MM-DD"}\nDo not guess or infer values.\n\nTEXT:\n${text.slice(0, 6000)}`
        )
        const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))
        const pick = (k: keyof Extracted) => (typeof parsed[k] === "string" ? parsed[k].trim() : "")
        return {
          docType: parsed.docType in DOC_TYPES ? parsed.docType : fallback.docType,
          ownerName: pick("ownerName"),
          businessName: pick("businessName"),
          address: pick("address"),
          number: pick("number"),
          tin: pick("tin"),
          issuedOn: pick("issuedOn"),
          expiresOn: pick("expiresOn"),
          source: "ai",
        }
      } catch {
        return fallback
      }
    },
    explain: (question, context) =>
      aiPrompt(
        `You are Kuya Hermit, a friendly assistant for Philippine MSME owners. Answer in simple Taglish using ONLY the facts below. Do not add requirements, fees or deadlines that are not listed. Do not give legal or tax advice; suggest the Negosyo Center or RDO when unsure.\n\nFACTS:\n${context}\n\nQUESTION: ${question}`
      ),
  },
  pay: {
    createPayment: async ({ txnid, amount, items, callbackUrl, redirectUrl }) => {
      const token = env("EGOV_PAY_TOKEN")
      const digest = createHmac("sha256", token.replace(/^test_/, ""))
        .update(`${amount}|${txnid}`)
        .digest("hex")
      const data = await egovPay.generatePayment({
        client: client("pay", { "X-eGovPay-Token": token }),
        body: {
          txnid,
          amount,
          items,
          digest,
          callback_url: callbackUrl,
          redirect_url: redirectUrl,
          settlement_template_uuid: env("EGOV_PAY_SETTLEMENT_TEMPLATE"),
        },
        throwOnError: true,
      })
      return { url: data.data.url, uuid: data.data.uuid }
    },
  },
  report: {
    submit: async ({ identity: id, subject, message, reportType }) => {
      const c = client("report")
      const tok = await eReport.generateToken({
        client: c,
        body: { access_code: env("EGOV_EREPORT_ACCESS_CODE") },
        throwOnError: true,
      })
      const data = await eReport.submitComplaint({
        client: c,
        auth: tok.access_token,
        body: {
          first_name: id.firstName,
          last_name: id.lastName,
          gender: id.gender,
          mobile: id.mobile,
          complainant_email: id.email,
          region_code: id.regionCode,
          province_code: id.provinceCode,
          municipality_code: id.municipalityCode,
          barangay_code: id.barangayCode,
          report_type: reportType,
          subject,
          message,
        },
        throwOnError: true,
      })
      return { caseNumber: data.case_number }
    },
  },
  chain: {
    anchor: async () => {
      throw new Error("eGovChain anchoring needs a signing wallet; not wired yet (PRD F5 stretch).")
    },
  },
}
