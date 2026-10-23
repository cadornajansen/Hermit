import assert from "node:assert/strict"
import { test } from "node:test"
import { loadRuntime } from "../test-support/runtime.mjs"

test("shared Google loader handles script failure, timeout, retry and successful reuse without live requests", async (t) => {
  const originals = ["window", "document"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  const target: Record<string, unknown> = {}
  const scripts: { onerror: () => void; remove: () => void }[] = []
  let removed = 0
  Object.defineProperty(globalThis, "window", { configurable: true, value: target })
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => ({ remove: () => { removed++ } }), head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
  } })
  t.after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) } })
  const api = await loadRuntime("lib/google-maps-loader.ts")
  const first = api.loadGoogleMaps("synthetic", 1000)
  const concurrent = api.loadGoogleMaps("synthetic", 1000)
  assert.equal(first, concurrent)
  scripts[0].onerror()
  await assert.rejects(first, /could not load/)
  assert.equal(removed, 1)
  await assert.rejects(api.loadGoogleMaps("synthetic", 5), /could not load/)
  assert.equal(removed, 2)
  const retry = api.loadGoogleMaps("synthetic", 1000)
  target.google = { maps: { importLibrary: () => {} } }
  ;(target.__hermitOfficeMapReady as () => void)()
  await retry
  await api.loadGoogleMaps("synthetic", 1000)
  assert.equal(scripts.length, 3)
})
