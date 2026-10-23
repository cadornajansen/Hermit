import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import type { ReactElement, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"
import { EMPTY_PROFILE } from "./engine.ts"

type Element = ReactElement<Record<string, unknown>>
function elements(node: ReactNode): Element[] {
  if (!node || typeof node !== "object") return []
  if (Array.isArray(node)) return node.flatMap(elements)
  const element = node as Element
  return [element, ...elements(element.props?.children as ReactNode)]
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(text).join("")
  return node && typeof node === "object" ? text((node as Element).props?.children as ReactNode) : ""
}
function click(node: ReactNode, label: string) {
  const element = elements(node).find((entry) => typeof entry.props?.onClick === "function" && text(entry.props.children as ReactNode).includes(label))
  assert.ok(element, `Missing action: ${label}`)
  ;(element.props.onClick as () => void)()
}

async function harness(t: TestContext, mapFailure = false) {
  const fixture = { slots: [] as unknown[], cursor: 0, effects: [] as (() => (() => void) | void)[], pending: Promise.resolve(), calls: [] as string[], response: { ok: true, candidates: [], partial: false } as unknown }
  Object.assign(globalThis, { __hermitOfficeHooks: fixture })
  t.after(() => { Reflect.deleteProperty(globalThis, "__hermitOfficeHooks") })
  const react = dataModule(`
    export {createElement} from ${JSON.stringify(import.meta.resolve("react"))};
    export const useState=initial=>{const f=globalThis.__hermitOfficeHooks;const i=f.cursor++;if(!(i in f.slots))f.slots[i]=typeof initial==='function'?initial():initial;return [f.slots[i],value=>{f.slots[i]=typeof value==='function'?value(f.slots[i]):value}]};
    export const useRef=initial=>useState({current:initial})[0];
    export const useId=()=> 'synthetic-'+globalThis.__hermitOfficeHooks.cursor++;
    export const useEffect=effect=>{globalThis.__hermitOfficeHooks.effects.push(effect)};
    export const useTransition=()=>[false,fn=>{globalThis.__hermitOfficeHooks.pending=fn()}];
  `)
  const stubs = {
    react,
    "@/app/maps": dataModule("export const geocodeOrigin=async(query)=>{const f=globalThis.__hermitOfficeHooks;f.calls.push(query);return f.response};"),
    "@/app/actions": dataModule("export const reportProblem=async()=>({ok:false,error:'synthetic'});"),
    "@/components/location-fields": dataModule("export const LocationFields=()=>null;"),
    "@/components/ui/button": dataModule(`import {createElement} from ${JSON.stringify(import.meta.resolve("react"))};export const Button=({children,variant,size,...props})=>createElement('button',props,children);export const buttonVariants=()=>'';`),
    "@/components/ui/input": dataModule(`import {createElement} from ${JSON.stringify(import.meta.resolve("react"))};export const Input=props=>createElement('input',props);`),
    "@/lib/store": dataModule("export const useProfile=()=>({});"),
    "@/components/office-map": dataModule("export const OfficeMap=()=>null;"),
    "@/lib/google-maps-loader": dataModule("export const loadGoogleMaps=async()=>{throw Error('synthetic script failure')};"),
  }
  const ui = await loadRuntime(mapFailure ? "components/office-map.tsx" : "components/office-finder.tsx", stubs)
  return { fixture, ui, render: (render: () => ReactNode) => { fixture.cursor = 0; fixture.effects = []; return render() } }
}

function navigatorStub(t: TestContext, geolocation: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { geolocation } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, "navigator", previous); else Reflect.deleteProperty(globalThis, "navigator") })
}

test("denied location preserves consent and never retries from a saved address", async (t) => {
  const h = await harness(t)
  let requests = 0
  navigatorStub(t, { getCurrentPosition: (_success: unknown, failure: (value: { code: number }) => void) => { requests++; failure({ code: 1 }) } })
  const origins: unknown[] = []
  const render = () => h.render(() => h.ui.OriginSearch({ canGeocode: true, businessAddress: "Synthetic saved business address", onOrigin: (value: unknown) => origins.push(value) }))
  render()
  assert.equal(requests, 0, "permission must not be requested on render")
  click(render(), "Use device location")
  const output = renderToStaticMarkup(render())
  assert.match(output, /permission was denied/)
  assert.match(output, /City, barangay, or starting address/)
  assert.doesNotMatch(output, /Retry same address/)
  assert.deepEqual(h.fixture.calls, [])
  assert.equal(origins.length, 0)
  click(render(), "Search saved business address")
  await h.fixture.pending
  assert.deepEqual(h.fixture.calls, ["Synthetic saved business address"], "saved address requires its own explicit action")
  assert.equal(requests, 1)
})

test("unavailable, stale and inaccurate device fixes have explicit recovery without changing jurisdiction", async (t) => {
  const h = await harness(t)
  const origins: { accuracy?: number }[] = []
  let position = { coords: { latitude: 14.6, longitude: 120.98, accuracy: 500 }, timestamp: Date.now() - 600_000 }
  navigatorStub(t, { getCurrentPosition: (success: (value: unknown) => void) => success(position) })
  const render = () => h.render(() => h.ui.OriginSearch({ canGeocode: false, businessAddress: "Saved address", onOrigin: (value: { accuracy?: number }) => origins.push(value) }))
  click(render(), "Use device location")
  assert.match(renderToStaticMarkup(render()), /stale or invalid/)
  assert.equal(origins.length, 0)
  position = { ...position, timestamp: Date.now() }
  click(render(), "Use device location")
  assert.equal(origins[0].accuracy, 500)
  assert.deepEqual(h.fixture.calls, [])
})

test("ambiguous and partial geocoding requires selection and preserves the previous origin until confirmation", async (t) => {
  const h = await harness(t)
  const first = { id: "0", label: "Synthetic city center", approximate: true, point: { lat: 14.6, lng: 120.98 } }
  h.fixture.response = { ok: true, candidates: [first, { ...first, id: "1", label: "Other match" }], partial: true }
  const origins: unknown[] = []
  const render = () => h.render(() => h.ui.OriginSearch({ canGeocode: true, businessAddress: "Synthetic address", origin: { source: "device", label: "Previous device location", point: { lat: 0, lng: 0 } }, onOrigin: (value: unknown) => origins.push(value) }))
  click(render(), "Search saved business address")
  await h.fixture.pending
  const output = renderToStaticMarkup(render())
  assert.match(output, /Partial matches/)
  assert.match(output, /Confirm a starting point/)
  assert.match(output, /Previous device location/)
  assert.deepEqual(origins, [])
  click(render(), "Use Synthetic city center")
  assert.deepEqual(origins, [{ point: first.point, label: `${first.label} (approximate area/address match)`, source: "search" }])
})

test("unsupported device location keeps manual search available without a provider call", async (t) => {
  const h = await harness(t)
  navigatorStub(t, undefined)
  const render = () => h.render(() => h.ui.OriginSearch({ canGeocode: true, businessAddress: "Saved address", onOrigin: () => { throw Error("must not change origin") } }))
  click(render(), "Use device location")
  const output = renderToStaticMarkup(render())
  assert.match(output, /Device location is unavailable/)
  assert.match(output, /City, barangay, or starting address/)
  assert.deepEqual(h.fixture.calls, [])
})

test("quota exhaustion disables same-address retry during cooldown and never auto-retries", async (t) => {
  const h = await harness(t)
  h.fixture.response = { ok: false, error: "quota", retryAfterSeconds: 60 }
  const render = () => h.render(() => h.ui.OriginSearch({ canGeocode: true, businessAddress: "Synthetic explicit address", onOrigin: () => { throw Error("must not change origin") } }))
  click(render(), "Search saved business address")
  await h.fixture.pending
  const output = render()
  const retry = elements(output).find((entry) => text(entry.props.children as ReactNode) === "Retry same address")!
  assert.equal(retry.props.disabled, true)
  assert.match(renderToStaticMarkup(output), /address-search limit has been reached/)
  assert.deepEqual(h.fixture.calls, ["Synthetic explicit address"])
  const cleanup = h.fixture.effects[0]()
  t.after(() => cleanup?.())
})

test("zero results and provider failures preserve input, and retry uses the same explicit address", async (t) => {
  const h = await harness(t)
  const render = () => h.render(() => h.ui.OriginSearch({ canGeocode: true, businessAddress: "First explicit address", onOrigin: () => { throw Error("must not change origin") } }))
  click(render(), "Search saved business address")
  await h.fixture.pending
  assert.match(renderToStaticMarkup(render()), /No address matches/)
  h.fixture.response = { ok: false, error: "unavailable" }
  click(render(), "Search saved business address")
  await h.fixture.pending
  click(render(), "Retry same address")
  await h.fixture.pending
  assert.deepEqual(h.fixture.calls, ["First explicit address", "First explicit address", "First explicit address"])
})

test("switching office selection updates map props and accessible list state, with truthful distances and partial coverage", async (t) => {
  const h = await harness(t)
  const evidence = { sourceUrl: "https://agency.invalid/", checkedOn: "2026-10-01", reviewDue: "2027-01-01", reviewer: "Synthetic" }
  const offices = ["a", "b", "c"].map((id, index) => ({
    office: { id, name: `Synthetic office ${id}`, mode: "physical", address: `Synthetic address ${id}`, website: "https://agency.invalid/" },
    point: index === 2 ? undefined : { lat: 14.6 + index * 0.01, lng: 120.98 }, evidence, coverageEvidence: evidence,
  }))
  const render = () => h.render(() => h.ui.OfficeResults({ offices, origin: { point: { lat: 14.6, lng: 120.98 }, label: "Synthetic origin", source: "device" }, showMap: true }))
  const officeMap = (node: ReactNode) => elements(node).find((entry) => entry.props.office && entry.props.origin)!
  assert.equal((officeMap(render()).props.office as { name: string }).name, "Synthetic office a")
  click(render(), "Synthetic office b")
  const output = render()
  assert.equal((officeMap(output).props.office as { name: string }).name, "Synthetic office b")
  const selected = elements(output).find((entry) => entry.props["aria-pressed"] === true)!
  assert.match(text(selected), /Synthetic office b/)
  const html = renderToStaticMarkup(output)
  assert.match(html, /Approximate straight-line distance/)
  assert.match(html, /Partial location coverage: 1/)
  assert.match(html, /Location needs verification/)
  assert.match(html, /lg:overflow-y-auto/)
  assert.doesNotMatch(html, /destination_place_id|origin=/)
})

test("unverified production coverage is an honest empty state with official guidance", async (t) => {
  const h = await harness(t)
  const profile = { ...EMPTY_PROFILE, city: "City of Manila", region: "National Capital Region (NCR)" }
  const render = () => h.render(() => h.ui.OfficeFinderPanel({ profile, items: {}, initialService: "mayors_permit", enabled: false, canGeocode: false }))
  const form = elements(render()).find((entry) => entry.type === "form")!
  ;(form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} })
  const output = renderToStaticMarkup(render())
  assert.match(output, /Verified office coverage is not yet available/)
  assert.match(output, /This does not mean no offices exist/)
  assert.match(output, /Official agency guidance/)
  assert.deepEqual(h.fixture.calls, [])
})

test("map loader failure has a visible retry and does not require removing the office list", async (t) => {
  const previous = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = "synthetic-not-a-key"
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY; else process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = previous
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window")
  })
  const h = await harness(t, true)
  const render = () => h.render(() => h.ui.OfficeMap({ origin: { point: { lat: 0, lng: 0 }, label: "Synthetic origin" } }))
  render()
  ;(h.fixture.slots[0] as { current: unknown }).current = {}
  const cleanup = h.fixture.effects[0]()
  t.after(() => cleanup?.())
  await new Promise(setImmediate)
  const html = renderToStaticMarkup(render())
  assert.match(html, /The map could not load/)
  assert.match(html, /Retry map/)
  assert.match(html, /office selection, and directions remain available/)
})
