import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import type { ReactElement, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"
import { businessSearchAddress } from "./nearby.ts"

const input = { address: "Synthetic San Jose, Tarlac", city: "San Jose", barangay: "", types: ["bplo", "sss"] }
const center = { lat: 15.4421, lng: 120.4672 }
const place = { id: "synthetic", displayName: { text: "Synthetic City Hall" }, formattedAddress: "Synthetic address", location: { latitude: center.lat, longitude: center.lng } }
async function maps(t: TestContext) {
  t.mock.method(console, "error", () => {})
  const previous = process.env.GOOGLE_MAPS_SERVER_KEY
  process.env.GOOGLE_MAPS_SERVER_KEY = "synthetic-not-a-key"
  t.after(() => { if (previous === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY; else process.env.GOOGLE_MAPS_SERVER_KEY = previous })
  return loadRuntime("app/maps.ts", { "@/lib/ratelimit": dataModule("export const takeAiQuota = async () => true;") })
}
test("address cache retains the geocoded center and offices; coordinates remain normalized", async (t) => {
  const api = await maps(t)
  let requests = 0
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests++
    return Response.json(String(url).includes("geocode") ? { status: "OK", results: [{ geometry: { location: center } }] } : { places: [place] })
  })
  const first = await api.findNearbyOffices(input)
  const calls = requests
  const second = await api.findNearbyOffices(input)
  assert.equal(first.ok, true)
  assert.equal(second.cached, true)
  assert.deepEqual(second.center, center)
  assert.deepEqual(second.offices, first.offices)
  assert.equal(requests, calls)
  const coordinates = { ...input, lat: 15.442123, lng: 120.467234 }
  const third = await api.findNearbyOffices(coordinates)
  const fourth = await api.findNearbyOffices(coordinates)
  assert.deepEqual(third.center, { lat: 15.442, lng: 120.467 })
  assert.deepEqual(fourth.center, third.center)
  assert.equal(fourth.cached, true)
})

test("Places total failures, partial failures, successful empties and retry are distinct", async (t) => {
  const api = await maps(t)
  let mode = "failed"
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const text = JSON.parse(String(init.body)).textQuery
    if (mode === "failed" || (mode === "mixed" && text.startsWith("SSS"))) return new Response("unavailable", { status: 503 })
    return Response.json({ places: mode === "empty" ? [] : [place] })
  })
  const coordinates = { ...input, lat: center.lat, lng: center.lng }
  assert.equal((await api.findNearbyOffices(coordinates)).ok, false)
  mode = "mixed"
  const partial = await api.findNearbyOffices(coordinates)
  assert.equal(partial.ok, true)
  assert.equal(partial.offices.length, 1)
  assert.deepEqual(partial.failedTypes, ["sss"])
  mode = "empty"
  const empty = await api.findNearbyOffices(coordinates)
  assert.equal(empty.ok, true)
  assert.equal(empty.cached, false, "partial failures must be retried")
  assert.deepEqual(empty.offices, [])
  assert.deepEqual(empty.failedTypes, [])
  assert.equal((await api.findNearbyOffices(coordinates)).cached, true)
})

test("geocoding HTTP errors are unavailable rather than empty places", async (t) => {
  const api = await maps(t)
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }))
  const result = await api.findNearbyOffices(input)
  assert.equal(result.ok, false)
  assert.match(result.error, /Google Maps/)
})

test("Maps address retains province/region without duplicating freeform locality", () => {
  const p = { businessAddress: "12 Synthetic Road, Brgy. Example, San Jose, Tarlac", barangay: "Example", city: "San Jose", province: "Tarlac", region: "Central Luzon (Region III)" }
  const address = businessSearchAddress(p)
  assert.equal(address, `${p.businessAddress}, ${p.region}, Philippines`)
  assert.equal(businessSearchAddress({ businessAddress: "12 Road", barangay: "", city: "San Jose", province: "Tarlac", region: "" }), "12 Road, San Jose, Tarlac, Philippines")
  assert.equal(businessSearchAddress({ businessAddress: "12 Road", barangay: "", city: "Taguig" }), "12 Road, Taguig, Philippines")
})

test("office UI distinguishes unavailable, partial and no-matches states and exposes retry", async () => {
  const fixture = { slots: [] as unknown[], cursor: 0, response: {} as unknown, pending: Promise.resolve() }
  Object.assign(globalThis, { __hermitMapsUi: fixture })
  const ui = await loadRuntime("app/(app)/offices/page.tsx", {
    react: dataModule(`const f=globalThis.__hermitMapsUi;export const useState=(initial)=>{const i=f.cursor++;if(!(i in f.slots))f.slots[i]=initial;return [f.slots[i],v=>{f.slots[i]=v}]};export const useTransition=()=>[false,fn=>{f.pending=fn()}];`),
    "@/app/maps": dataModule("export const findNearbyOffices=async()=>globalThis.__hermitMapsUi.response;"),
    "@/app/actions": dataModule("export const reportProblem=async()=>{};"),
    "@/components/office-map": dataModule("export const mapsOnPage=true;export const COLORS={bplo:'blue'};export const OfficeMap=()=>null;"),
    "@/components/ui/button": dataModule("export const Button=({children,...props})=>children;export const buttonVariants=()=>'';"),
    "@/lib/store": dataModule("export const useProfile=()=>({});"),
  })
  const render = () => { fixture.cursor = 0; return ui.NearMe({ types: ["bplo"], city: "San Jose", barangay: "", address: "Synthetic address" }) }
  function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
    if (!node || typeof node !== "object") return []
    if (Array.isArray(node)) return node.flatMap(elements)
    const element = node as ReactElement<Record<string, unknown>>
    return [element, ...elements(element.props?.children as ReactNode)]
  }
  for (const [response, expected, absent] of [
    [{ ok: false, error: "Google Maps failed" }, /Maps unavailable/, /No matches|Partial results/],
    [{ ok: true, center, offices: [], failedTypes: [] }, /No matches/, /Maps unavailable|Partial results/],
    [{ ok: true, center, offices: [{ type: "bplo", placeId: "synthetic", name: "Synthetic Hall", km: 1, address: "Synthetic" }], failedTypes: ["sss"] }, /Partial results/, /Maps unavailable|No matches/],
  ] as const) {
    fixture.response = response
    const button = elements(render()).find((node) => String(node.props?.children).includes("Gamitin ang address"))
    assert.ok(button)
    ;(button.props.onClick as () => void)()
    await fixture.pending
    const html = renderToStaticMarkup(render())
    assert.match(html, expected)
    assert.doesNotMatch(html, absent)
    assert.match(html, /Retry/)
  }
})
