import type { Classification, Egov, Identity } from "./index"

// Offline stand-ins so the whole flow works before credentials arrive.

const SAMPLE: Identity = {
  firstName: "Juana",
  middleName: "Santos",
  lastName: "Dela Cruz",
  birthDate: "1980-05-14",
  address: "123 Sample St., Western Bicutan, Taguig City",
  barangay: "Western Bicutan",
  municipality: "Taguig",
  mobile: "+639170000000",
  email: "juana@example.com",
  gender: "female",
  regionCode: "",
  provinceCode: "",
  municipalityCode: "",
  barangayCode: "",
}

// Keyword classifier: also the fallback when eGov AI is down or unsure.
// PSIC 2009 class codes; the owner always confirms.
const RULES: [RegExp, Classification][] = [
  [/(bake|gawa|luto.*(benta|tinda).*(tindahan|grocery)|packag|snack|chips|repack|bottl|preserve|tuyo|daing)/i, { category: "packaged_food", psic: "1079", label: "Manufacture of other food products" }],
  [/(ulam|karinderya|carinderia|kain|restaurant|resto|caf[eé]|kape|coffee|food ?cart|kitchen|lutong|tapsi|grill)/i, { category: "food_service", psic: "5610", label: "Restaurants and mobile food service" }],
  [/(sari|tindahan|store|grocery|retail|tinda|paninda)/i, { category: "retail", psic: "4711", label: "Retail sale in non-specialized stores, food predominating" }],
  [/(online|shopee|lazada|tiktok|facebook|fb|live ?sell)/i, { category: "retail", psic: "4791", label: "Retail sale via internet" }],
]

export function classifyByKeywords(description: string): Classification {
  return (
    RULES.find(([re]) => re.test(description))?.[1] ?? {
      category: "other",
      psic: "",
      label: "Not sure — please pick a category",
    }
  )
}

export const mock: Egov = {
  sso: {
    loginUrl: (callbackUrl) => `${callbackUrl}?exchange_code=mock`,
    exchange: async () => SAMPLE,
  },
  liveness: {
    start: async (callbackUrl) => ({ sessionId: "mock-liveness", url: `${callbackUrl}?session=mock-liveness` }),
    result: async () => ({ passed: true, score: 0.99 }),
  },
  everify: {
    verify: async (id) => ({ verified: true, fullAddress: id.address }),
  },
  emessage: {
    sendSms: async (to, message) => {
      console.log(`[eMessage mock] → ${to}: ${message}`)
    },
  },
  ai: {
    classify: async (d) => classifyByKeywords(d),
    explain: async (_q, context) => context,
  },
  pay: {
    createPayment: async ({ txnid, redirectUrl }) => ({
      uuid: `mock-${txnid}`,
      url: `${redirectUrl}?mock_paid=${txnid}`,
    }),
  },
  report: {
    submit: async () => ({ caseNumber: `MOCK-${Date.now().toString(36).toUpperCase()}` }),
  },
  chain: {
    anchor: async (sha256) => ({ txHash: `0xmock${sha256.slice(0, 16)}` }),
  },
}
