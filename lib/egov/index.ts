import "server-only"

import type { Category, Extracted } from "@/lib/types"
import { mock } from "./mock"
import { live } from "./live"

// The socket every eGov API plugs into (PRD §9, risk: "abstract each API
// behind an adapter"). Each service runs on its mock until its credentials
// appear in the environment — then it switches to the real egov.js client.
// See .env.example for the variables per service.

export type Identity = {
  uniqid: string // eGovPH account id (SSO); "" for manual / eVerify-only
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  birthDate: string // YYYY-MM-DD
  address: string
  barangay: string
  municipality: string
  mobile: string
  email: string
  gender: string
  // PSGC codes, needed by eReport
  regionCode: string
  provinceCode: string
  municipalityCode: string
  barangayCode: string
}

export type Classification = { category: Category; psic: string; label: string }

export type Egov = {
  sso: {
    // eGovPH hands us a single-use exchange_code (in-app entry or the Login widget).
    exchange(exchangeCode: string): Promise<Identity>
  }
  everify: {
    // Face liveness runs in the browser (eVerify Web SDK); this matches its
    // session + the owner's name and birthday against PhilSys.
    verify(
      person: Pick<Identity, "firstName" | "middleName" | "lastName" | "suffix" | "birthDate">,
      livenessSessionId: string
    ): Promise<{ verified: false } | { verified: true; identity: Partial<Identity> }>
  }
  emessage: {
    sendSms(e164: string, message: string): Promise<void>
  }
  ai: {
    classify(description: string): Promise<Classification>
    // Rewrites grounded context into a plain Taglish answer. Never decides requirements.
    explain(question: string, groundedContext: string): Promise<string>
    // Reads a document (type, names, numbers, dates). Never judges validity —
    // lib/vault.ts does that.
    extractDocument(file: File): Promise<Extracted>
  }
  pay: {
    createPayment(p: {
      txnid: string
      amount: number
      items: { name: string; amount: number }[]
      callbackUrl: string
      redirectUrl: string
    }): Promise<{ url: string; uuid: string }>
    // Status straight from eGovPay — the only source a payment is trusted from.
    getTransaction(uuid: string): Promise<{ paid: boolean; status: string; paidAt: string | null; channel: string | null; refno: string }>
  }
  report: {
    submit(r: { identity: Identity; subject: string; message: string; reportType: string }): Promise<{ caseNumber: string }>
  }
  chain: {
    // Tamper-evident anchor for a vault document hash (stretch, PRD F5).
    anchor(sha256: string): Promise<{ txHash: string }>
  }
}

export type ServiceName = keyof Egov

// Env vars whose presence switches a service from mock to live.
export const LIVE_WHEN: Record<ServiceName, string[]> = {
  sso: ["EGOV_SSO_PARTNER_CODE", "EGOV_SSO_PARTNER_SECRET"],
  everify: ["EGOV_EVERIFY_CLIENT_ID", "EGOV_EVERIFY_CLIENT_SECRET"],
  emessage: ["EGOV_EMESSAGE_TOKEN"],
  ai: ["EGOV_AI_ACCESS_CODE"],
  pay: ["EGOV_PAY_TOKEN", "EGOV_PAY_SETTLEMENT_TEMPLATE"],
  report: ["EGOV_EREPORT_ACCESS_CODE"],
  chain: ["EGOV_CHAIN_TOKEN"],
}

export const isLive = (s: ServiceName) => LIVE_WHEN[s].every((k) => process.env[k])

export const egov = <S extends ServiceName>(s: S): Egov[S] =>
  isLive(s) ? live[s] : mock[s]

export const serviceModes = () =>
  Object.fromEntries((Object.keys(LIVE_WHEN) as ServiceName[]).map((s) => [s, isLive(s) ? "live" : "mock"]))
