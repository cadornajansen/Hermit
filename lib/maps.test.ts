import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"
import { parseGeocodeResponse } from "./google-geocoding.ts"

const match = {
  formatted_address: "Synthetic address, Philippines", geometry: { location: { lat: 14.6, lng: 120.98 }, location_type: "ROOFTOP" },
  address_components: [{ short_name: "PH", types: ["country"] }],
}

async function action(t: TestContext, quota = "return {ok:true}") {
  const previous = { key: process.env.GOOGLE_MAPS_SERVER_KEY, flag: process.env.OFFICE_FINDER_ENABLED }
  process.env.GOOGLE_MAPS_SERVER_KEY = "synthetic-not-a-key"
  process.env.OFFICE_FINDER_ENABLED = "true"
  t.after(() => {
    if (previous.key === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY; else process.env.GOOGLE_MAPS_SERVER_KEY = previous.key
    if (previous.flag === undefined) delete process.env.OFFICE_FINDER_ENABLED; else process.env.OFFICE_FINDER_ENABLED = previous.flag
  })
  return loadRuntime("app/maps.ts", { "@/lib/ratelimit": dataModule(`export const takeGoogleGeocodeQuota=async()=>{${quota}};`) })
}

test("geocoding distinguishes ambiguous, approximate, partial, zero and invalid responses", () => {
  assert.deepEqual(parseGeocodeResponse({ status: "ZERO_RESULTS", results: [] }), { ok: true, candidates: [], partial: false })
  const response = parseGeocodeResponse({ status: "OK", results: [match, { ...match, partial_match: true }, { ...match, geometry: { ...match.geometry, location_type: "APPROXIMATE" } }, { ...match, geometry: { location: { lat: Infinity, lng: 0 } } }] })
  assert.equal(response.ok, true)
  if (!response.ok) return
  assert.equal(response.candidates.length, 3)
  assert.deepEqual(response.candidates.map((entry) => entry.approximate), [false, true, true])
  assert.equal(response.partial, true)
  for (const invalid of [null, {}, { status: "OK", results: [] }, { status: "OK", results: [null] }, { status: "OK", results: [{ ...match, address_components: [{ short_name: "US", types: ["country"] }] }] }]) assert.equal(parseGeocodeResponse(invalid).ok, false)
  assert.deepEqual(parseGeocodeResponse({ status: "OVER_QUERY_LIMIT" }), { ok: false, error: "quota", retryAfterSeconds: 60 })
})

test("one upstream request per attempt, no server caching, and no Places or Routes calls", async (t) => {
  const api = await action(t)
  let calls = 0
  t.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    calls++
    assert.equal(url.hostname, "maps.googleapis.com")
    assert.equal(url.pathname, "/maps/api/geocode/json")
    assert.equal(url.searchParams.get("components"), "country:PH")
    assert.equal(options.cache, "no-store")
    return Response.json({ status: "OK", results: [match] })
  })
  assert.equal((await api.geocodeOrigin("Synthetic city")).ok, true)
  assert.equal((await api.geocodeOrigin("Synthetic city")).ok, true)
  assert.equal(calls, 2)
})

test("invalid inputs, feature flag and missing credentials never call the provider", async (t) => {
  const api = await action(t, "throw Error('Quota must not be used')")
  t.mock.method(globalThis, "fetch", async () => { throw Error("Provider must not be called") })
  for (const input of [null, {}, 10, "", "ab", "x".repeat(301), "abc\nprivate"]) assert.deepEqual(await api.geocodeOrigin(input), { ok: false, error: "invalid" })
  process.env.OFFICE_FINDER_ENABLED = "false"
  assert.deepEqual(await api.geocodeOrigin("Synthetic city"), { ok: false, error: "disabled" })
  process.env.OFFICE_FINDER_ENABLED = "true"
  delete process.env.GOOGLE_MAPS_SERVER_KEY
  assert.deepEqual(await api.geocodeOrigin("Synthetic city"), { ok: false, error: "no_key" })
})

test("quota rejection and limiter failure prevent all provider calls", async (t) => {
  let calls = 0
  t.mock.method(globalThis, "fetch", async () => { calls++; throw Error("unexpected") })
  for (const quota of ["return {ok:false,error:'quota'}", "return {ok:false,error:'unavailable'}", "throw Error('offline')"]) {
    const api = await action(t, quota)
    assert.equal((await api.geocodeOrigin("Synthetic city")).ok, false)
  }
  assert.equal(calls, 0)
})

test("provider 429, HTTP failures, malformed JSON and timeouts return safe errors without logs", async (t) => {
  const api = await action(t)
  let logs = 0
  t.mock.method(console, "error", () => { logs++ })
  t.mock.method(console, "warn", () => { logs++ })
  for (const mode of ["429", "503", "json", "timeout"]) {
    t.mock.method(globalThis, "fetch", async () => {
      if (mode === "timeout") throw Error("private URL containing synthetic-not-a-key")
      return new Response("private provider body", { status: mode === "json" ? 200 : Number(mode) })
    })
    const result = await api.geocodeOrigin("Synthetic private address")
    assert.equal(result.ok, false)
    assert.doesNotMatch(JSON.stringify(result), /private|synthetic-not-a-key/)
  }
  assert.equal(logs, 0)
})
