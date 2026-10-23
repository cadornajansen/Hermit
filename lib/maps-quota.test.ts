import assert from "node:assert/strict"
import { test } from "node:test"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"

test("Google quota fails closed without a backend or trusted owner", async () => {
  for (const [backend, owner] of [["null", "'owner'"], ["{rpc:async()=>{throw Error('must not call')}}", "null"]]) {
    const api = await loadRuntime("lib/ratelimit.ts", {
      "server-only": dataModule(""), "@/lib/db": dataModule(`export const db=()=>${backend};`),
      "@/lib/session": dataModule(`export const ownerId=async()=>${owner};export const secret=()=> 'synthetic';`),
      "next/headers": dataModule("export const headers=async()=>new Headers();"),
    })
    assert.deepEqual(await api.takeGoogleGeocodeQuota(), { ok: false, error: "unavailable" })
  }
})

test("quota uses a shared first bucket, counts each request, and hashes IP without storing addresses", async (t) => {
  const previous = process.env.GOOGLE_MAPS_GEOCODE_DAILY_LIMIT
  delete process.env.GOOGLE_MAPS_GEOCODE_DAILY_LIMIT
  t.after(() => { if (previous === undefined) delete process.env.GOOGLE_MAPS_GEOCODE_DAILY_LIMIT; else process.env.GOOGLE_MAPS_GEOCODE_DAILY_LIMIT = previous })
  const state = { calls: [] as { name: string; args: { p_buckets: string[]; p_kind: string; p_limits: number[]; p_window_seconds: number[] } }[], data: true as unknown, error: null as unknown }
  Object.assign(globalThis, { __hermitMapsQuota: state })
  t.after(() => { Reflect.deleteProperty(globalThis, "__hermitMapsQuota") })
  const api = await loadRuntime("lib/ratelimit.ts", {
    "server-only": dataModule(""),
    "@/lib/db": dataModule("export const db=()=>({rpc:async(name,args)=>{const f=globalThis.__hermitMapsQuota;f.calls.push({name,args});return {data:f.data,error:f.error}}});"),
    "@/lib/session": dataModule("export const ownerId=async()=> 'synthetic-owner';export const secret=()=> 'synthetic';"),
    "next/headers": dataModule("export const headers=async()=>new Headers({'x-forwarded-for':'192.0.2.1'});"),
  })
  assert.deepEqual(await api.takeGoogleGeocodeQuota(), { ok: true })
  assert.deepEqual(await api.takeGoogleGeocodeQuota(), { ok: true })
  assert.equal(state.calls.length, 2)
  const { name, args } = state.calls[0]
  assert.equal(name, "take_ai_quota")
  assert.equal(args.p_kind, "google_geocoding")
  assert.equal(args.p_buckets[0], "provider:google-geocoding")
  assert.deepEqual(args.p_limits, [250, 60, 15, 40, 150])
  assert.deepEqual(args.p_window_seconds, [86400, 60, 3600, 86400, 3600])
  assert.match(args.p_buckets[4], /^ip:/)
  assert.doesNotMatch(JSON.stringify(args), /192\.0\.2\.1/)
  state.data = false
  assert.deepEqual(await api.takeGoogleGeocodeQuota(), { ok: false, error: "quota" })
  state.error = { message: "synthetic" }
  assert.deepEqual(await api.takeGoogleGeocodeQuota(), { ok: false, error: "unavailable" })
  state.error = null; state.data = null
  assert.deepEqual(await api.takeGoogleGeocodeQuota(), { ok: false, error: "unavailable" })
  for (const invalid of ["0", "-1", "no", "10001", "1.5", ""]) {
    process.env.GOOGLE_MAPS_GEOCODE_DAILY_LIMIT = invalid
    assert.deepEqual(await api.takeGoogleGeocodeQuota(), { ok: false, error: "unavailable" })
  }
})
