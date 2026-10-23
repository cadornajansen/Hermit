import "server-only"

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

import type { Identity } from "@/lib/egov"
import { getAccountUser } from "@/lib/supabase"

// Signed, httpOnly cookies:
// - hermit_session: verified identity from eGovPH SSO + eVerify
// - hermit_owner:   anonymous owner id that keys the owner's rows in Supabase
//   ("anonymous, then upgrade": SSO can later be linked to the same id).
// ponytail: lose the cookie, lose access to the server copy (the device still
// has its local copy). Add account linking (SSO / email OTP) to recover it.

export type Session = {
  identity: Identity
  livenessSessionId?: string
  verified: boolean
}

const SESSION = "hermit_session"
const OWNER = "hermit_owner"

export function secret() {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production")
  return "dev-only-secret"
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url")

async function writeSigned(name: string, value: unknown, maxAge: number) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url")
  ;(await cookies()).set(name, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  })
}

async function readSigned<T>(name: string): Promise<T | null> {
  const raw = (await cookies()).get(name)?.value
  if (!raw) return null
  const [payload, sig] = raw.split(".")
  const expected = Buffer.from(sign(payload ?? ""))
  const given = Buffer.from(sig ?? "")
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString())
  } catch {
    return null
  }
}

export const writeSession = (s: Session) => writeSigned(SESSION, s, 60 * 60 * 24 * 7)
export const readSession = () => readSigned<Session>(SESSION)

// Existing owner id, or a new one when create is set (only from Server Actions / Route Handlers).
export async function ownerId(create = false): Promise<string | null> {
  const account = await getAccountUser()
  if (account) return account.id
  const id = await readSigned<string>(OWNER)
  if (id || !create) return id
  const fresh = randomUUID()
  await writeSigned(OWNER, fresh, 60 * 60 * 24 * 400)
  return fresh
}

// Switch this device to an existing owner (a returning eGovPH user).
export const setOwner = (id: string) => writeSigned(OWNER, id, 60 * 60 * 24 * 400)

export async function clearSession() {
  const c = await cookies()
  c.delete(SESSION)
  c.delete(OWNER)
}
