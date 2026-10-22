import "server-only"

import type { Category, Extracted } from "@/lib/types"
import { mock } from "./mock"
import { live } from "./live"

// The socket every eGov API plugs into (PRD §9, risk: "abstract each API
// behind an adapter"). Each service runs on its mock until its credentials
// appear in the environment — then it switches to the real egov.js client.
// See .env.example for the variables per service.

export type Identity = {
  firstName: string
  middleName: string
  lastName: string
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
    loginUrl(callbackUrl: string): string
    exchange(exchangeCode: string): Promise<Identity>
  }
  liveness: {
    start(callbackUrl: string): Promise<{ sessionId: string; url: string }>
    result(sessionId: string): Promise<{ passed: boolean; score: number }>
  }
  everify: {
    verify(id: Identity, livenessSessionId: string): Promise<{ verified: boolean; fullAddress?: string }>
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
  sso: ["EGOV_SSO_PARTNER_CODE", "EGOV_SSO_PARTNER_SECRET", "EGOV_SSO_LOGIN_URL"],
  liveness: ["EGOV_LIVENESS_API_KEY"],
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
