import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

import type { Identity } from "@/lib/egov"

// Signed, httpOnly cookie holding the verified identity from SSO + eVerify.
// ponytail: stateless cookie session; move to a DB-backed session when
// PostgreSQL lands (needed for revocation and server-side reminders).

export type Session = {
  identity: Identity
  livenessSessionId?: string
  verified: boolean
}

const NAME = "hermit_session"
const MAX_AGE = 60 * 60 * 24 * 7

function secret() {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production")
  return "dev-only-secret"
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url")

export async function writeSession(s: Session) {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url")
  ;(await cookies()).set(NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  })
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(NAME)?.value
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

export async function clearSession() {
  ;(await cookies()).delete(NAME)
}
