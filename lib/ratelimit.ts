import "server-only"

import { createHmac } from "node:crypto"
import { headers } from "next/headers"

import { db } from "@/lib/db"
import { ownerId, secret } from "@/lib/session"

// Caps on paid AI calls, enforced in Postgres (public.take_ai_quota) so they
// hold across serverless instances. Per-owner stops one person burning
// credits; per-IP stops someone who keeps clearing cookies. The IP cap is
// generous because many Filipino mobile users share an IP (carrier CGNAT).
// ponytail: fixed numbers; move to env/config when real usage data exists.
const HOUR = 3600
const DAY = 86_400
const RULES = {
  chat: { ownerHour: 30, ownerDay: 120, ipHour: 300 },
  read: { ownerHour: 20, ownerDay: 60, ipHour: 150 },
  classify: { ownerHour: 10, ownerDay: 30, ipHour: 150 },
  verify: { ownerHour: 5, ownerDay: 10, ipHour: 40 }, // eVerify (PhilSys) checks
} as const

export type AiKind = keyof typeof RULES

async function ipBucket() {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")
  return ip ? `ip:${createHmac("sha256", secret()).update(ip).digest("base64url").slice(0, 22)}` : null
}

// true = go ahead (and the use is recorded). Without Supabase (local dev) there's no limit.
// If the check itself fails, say no: callers fall back to the free non-AI path.
export async function takeAiQuota(kind: AiKind): Promise<boolean> {
  const sb = db()
  if (!sb) return true
  const owner = await ownerId(true)
  const ip = await ipBucket()
  const r = RULES[kind]
  const buckets = [`owner:${owner}`, `owner:${owner}`]
  const limits: number[] = [r.ownerHour, r.ownerDay]
  const windows = [HOUR, DAY]
  if (ip) {
    buckets.push(ip)
    limits.push(r.ipHour)
    windows.push(HOUR)
  }
  const { data, error } = await sb.rpc("take_ai_quota", {
    p_kind: kind,
    p_buckets: buckets,
    p_limits: limits,
    p_window_seconds: windows,
  })
  if (error) {
    console.error("AI quota check failed; skipping AI for this call", error)
    return false
  }
  return data === true
}

// The existing RPC locks its first bucket. A common first bucket serializes all maps callers.
export async function takeGoogleGeocodeQuota(): Promise<{ ok: true } | { ok: false; error: "quota" | "unavailable" }> {
  try {
    const sb = db()
    const daily = Number(process.env.GOOGLE_MAPS_GEOCODE_DAILY_LIMIT ?? 250)
    if (!sb || !Number.isSafeInteger(daily) || daily < 1 || daily > 10_000) return { ok: false, error: "unavailable" }
    const owner = await ownerId()
    if (!owner) return { ok: false, error: "unavailable" }
    const ip = await ipBucket()
    const buckets = ["provider:google-geocoding", "provider:google-geocoding", `owner:${owner}`, `owner:${owner}`]
    const limits = [daily, 60, 15, 40]
    const windows = [DAY, 60, HOUR, DAY]
    if (ip) { buckets.push(ip); limits.push(150); windows.push(HOUR) }
    const { data, error } = await sb.rpc("take_ai_quota", {
      p_kind: "google_geocoding", p_buckets: buckets, p_limits: limits, p_window_seconds: windows,
    })
    if (error || typeof data !== "boolean") return { ok: false, error: "unavailable" }
    return data ? { ok: true } : { ok: false, error: "quota" }
  } catch {
    return { ok: false, error: "unavailable" }
  }
}
