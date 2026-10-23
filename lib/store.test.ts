import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import ts from "typescript"

import { EMPTY_PROFILE } from "./engine.ts"
import { loadFormMemory, memoryKey, ownerStateKey } from "./form-memory.ts"

const require = createRequire(import.meta.url)
const dataModule = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
let serial = 0

// Exercise the real store and Server Actions without Next's cookie/database
// runtime. Only the external boundaries are replaced; production logic runs.
async function loadModule(path: string, imports: Record<string, string>) {
  const source = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  ).outputText
  const code = source.replace(
    /from (["'])([^"']+)\1/g,
    (original, _quote, specifier) => {
      if (specifier.startsWith("node:")) return original
      const target =
        imports[specifier] ??
        (specifier.startsWith(".")
          ? new URL(`${specifier}.ts`, new URL(path, import.meta.url)).href
          : pathToFileURL(require.resolve(specifier)).href)
      return `from ${JSON.stringify(target)}`
    }
  )
  return import(dataModule(`${code}\n// instance ${serial++}`))
}

class Disk {
  [key: string]: unknown
  getItem(key: string) {
    return Object.hasOwn(this, key) ? (this[key] as string) : null
  }
  setItem(key: string, value: string) {
    Object.defineProperty(this, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }
  removeItem(key: string) {
    delete this[key]
  }
}

function hookHost() {
  const slots: { value?: unknown; deps?: unknown[]; cleanup?: () => void }[] = []
  let cursor = 0
  let effects: (() => void)[] = []
  function useState(initial: unknown) {
    const index = cursor++
    slots[index] ??= { value: typeof initial === "function" ? initial() : initial }
    return [slots[index].value, (next: unknown) => {
      slots[index].value = typeof next === "function" ? next(slots[index].value) : next
    }]
  }
  return {
    useState,
    useRef(initial: unknown) { return useState({ current: initial })[0] },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const index = cursor++
      const previous = slots[index]
      if (previous?.deps?.length === deps.length && deps.every((value, i) => Object.is(value, previous.deps![i]))) return
      slots[index] = { deps }
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect() || undefined })
    },
    render(render: () => unknown) { cursor = 0; return render() },
    flush() { const pending = effects; effects = []; pending.forEach((effect) => effect()) },
  }
}

test("handoff works when consent is declined or saving fails; success resets the checkbox", async () => {
  const host = hookHost()
  const fixture = { ownerId: "A", attempts: 0, fail: false, host }
  Object.assign(globalThis, { __hermitConsentTest: fixture })
  const consent = await loadModule("../components/form-consent.tsx", {
    "react": dataModule("const h = globalThis.__hermitConsentTest.host; export const useState = (...args) => h.useState(...args);"),
    "@/lib/store": dataModule("const f = globalThis.__hermitConsentTest; export const useHermit = () => ({ ownerId: f.ownerId }); export const saveFormAnswers = async () => { f.attempts++; if (f.fail) throw Error('storage blocked'); };"),
    "@/lib/form-memory": new URL("./form-memory.ts", import.meta.url).href,
    "next/link": dataModule("export default function Link() { return null; }"),
  })
  const render = (form = "dti_bn") => host.render(() => consent.useFormConsent({ email: "a@example.test" }, form)) as ReturnType<typeof consent.useFormConsent>
  let controller = render()
  const checkbox = () => controller.choice.props.children[0].props.children[0]
  let handoffs = 0
  const handoff = async () => { handoffs++; await controller.remember() }
  assert.equal(checkbox().props.checked, false)
  await handoff()
  assert.equal(fixture.attempts, 0)
  assert.equal(handoffs, 1)
  checkbox().props.onChange({ target: { checked: true } })
  controller = render()
  fixture.fail = true
  await assert.doesNotReject(handoff())
  assert.equal(handoffs, 2)
  assert.equal(fixture.attempts, 1)
  controller = render()
  assert.match(JSON.stringify(controller.choice), /could not be saved/)
  fixture.fail = false
  checkbox().props.onChange({ target: { checked: true } })
  controller = render()
  await handoff()
  controller = render()
  assert.equal(checkbox().props.checked, false, "success does not enable saving on the next form")
  checkbox().props.onChange({ target: { checked: true } })
  fixture.ownerId = "B"
  controller = render()
  assert.equal(checkbox().props.checked, false, "an owner switch cannot inherit the prior owner's choice")
  controller = render("sss_r1")
  assert.equal(checkbox().props.checked, false, "a different form needs a new choice")
  fixture.ownerId = "A"
  controller = render()
  assert.equal(checkbox().props.checked, false, "returning to the previous account does not restore an old choice")
})

test("PDF transitions do not write a previous file's draft or reveal a previous owner's values while loading", async (t) => {
  const { draftKey } = await import("./fill.ts")
  const host = hookHost()
  const one = { path: "dti_bn/one.pdf", url: "https://hermit.test/one.pdf", label: "One", kind: "form" }
  const two = { ...one, path: "dti_bn/two.pdf", url: "https://hermit.test/two.pdf", label: "Two" }
  const layout = { formId: "dti_bn", sha256: "synthetic", fillable: false, pages: [], entries: [{ key: "email", page: 0, x: 10, y: 10, size: 10 }] }
  const state = { ownerId: "A", profile: { ...EMPTY_PROFILE, email: "account-A@example.test" }, formMemory: { consentedAt: null, answers: {} }, formEdits: {}, pdfDrafts: {} as Record<string, unknown> }
  const fixture = { files: [one, two], state, host }
  Object.assign(globalThis, { __hermitPdfTest: fixture })
  const pending: ((value: Response) => void)[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => new Promise<Response>((resolve) => { pending.push(resolve) })
  t.after(() => { globalThis.fetch = originalFetch })
  const editor = await loadModule("../components/pdf-editor.tsx", {
    "react": dataModule("const h = globalThis.__hermitPdfTest.host; export const useState = (...args) => h.useState(...args); export const useRef = (...args) => h.useRef(...args); export const useEffect = (...args) => h.useEffect(...args);"),
    "@/lib/store": dataModule("const f = globalThis.__hermitPdfTest; export const useProfile = () => f.state; export const update = fn => Object.assign(f.state, fn(f.state));"),
    "@/lib/forms": new URL("./forms.ts", import.meta.url).href,
    "@/lib/fill": new URL("./fill.ts", import.meta.url).href,
    "@/lib/form-layouts.json": dataModule(`export default ${JSON.stringify({ [one.path]: layout, [two.path]: layout })};`),
    "@/lib/library": dataModule("export const libraryFiles = () => globalThis.__hermitPdfTest.files;"),
    "@/lib/utils": dataModule("export const cn = (...values) => values.filter(Boolean).join(' ');"),
    "@/components/form-consent": dataModule("export const useFormConsent = () => ({ choice: null, remember: async () => {} });"),
    "@/components/ui/button": dataModule("export function Button() { return null; }"),
    "next/link": dataModule("export default function Link() { return null; }"),
  })
  const render = (path: string) => host.render(() => editor.PdfEditor({ formId: "dti_bn", filePath: path }))
  render(one.path)
  host.flush()
  pending.shift()!(new Response(new Uint8Array([0])))
  await new Promise(setImmediate)
  render(one.path)
  host.flush()
  const firstKey = draftKey("A", one.path, layout)
  assert.ok(state.pdfDrafts[firstKey])
  const whileLoading = render(two.path)
  host.flush()
  assert.equal(state.pdfDrafts[draftKey("A", two.path, layout)], undefined, "old boxes must not be saved under the new file key")
  assert.doesNotMatch(JSON.stringify(whileLoading), /account-A@example/)
  pending.shift()!(new Response(new Uint8Array([0])))
  await new Promise(setImmediate)
  render(two.path)
  host.flush()
  assert.ok(state.pdfDrafts[draftKey("A", two.path, layout)])
  state.ownerId = "B"
  state.profile = { ...EMPTY_PROFILE, email: "account-B@example.test" }
  const switched = render(two.path)
  host.flush()
  assert.doesNotMatch(JSON.stringify(switched), /account-A@example/)
  assert.equal(state.pdfDrafts[draftKey("B", two.path, layout)], undefined)
  pending.shift()!(new Response(new Uint8Array([0])))
  await new Promise(setImmediate)
  render(two.path)
  host.flush()
  assert.match(JSON.stringify(state.pdfDrafts[draftKey("B", two.path, layout)]), /account-B@example/)
  assert.doesNotMatch(JSON.stringify(state.pdfDrafts[draftKey("B", two.path, layout)]), /account-A@example/)
})

test("SSO never binds a different citizen to the previous owner's row or local scope", async () => {
  const fixture = { owner: "owner-A", previousIdentity: "citizen-A", identity: "citizen-B", backend: false, existing: null as { id: string; profile: object } | null, inserted: [] as { id: string; egov_uniqid: string }[] }
  Object.assign(globalThis, { __hermitSsoTest: fixture })
  const sso = await loadModule("../app/egovph/sso/route.ts", {
    "next/navigation": dataModule("export const redirect = path => { throw Error('redirect:' + path); };"),
    "@/lib/egov": dataModule("export const egov = () => ({ exchange: async () => ({ uniqid: globalThis.__hermitSsoTest.identity }) });"),
    "@/lib/session": dataModule(`const f = globalThis.__hermitSsoTest; export const ownerId = async () => f.owner; export const readSession = async () => ({ identity: { uniqid: f.previousIdentity } }); export const setOwner = async id => { f.owner = id; }; export const writeSession = async session => { f.previousIdentity = session.identity.uniqid; };`),
    "@/lib/db": dataModule(`const f = globalThis.__hermitSsoTest; export const db = () => !f.backend ? null : ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: f.existing, error: null }) }) }), insert: async row => { f.inserted.push(row); return { error: null }; } }) });`),
  })
  const request = new Request("https://hermit.test/egovph/sso?exchange_code=synthetic")
  await assert.rejects(sso.GET(request), /redirect:/)
  assert.notEqual(fixture.owner, "owner-A", "different citizen without a backend must rotate the owner")
  const b = fixture.owner
  await assert.rejects(sso.GET(request), /redirect:/)
  assert.equal(fixture.owner, b, "proven same citizen can retain local information")
  fixture.owner = "owner-A"
  fixture.previousIdentity = "citizen-A"
  fixture.backend = true
  await assert.rejects(sso.GET(request), /redirect:/)
  assert.notEqual(fixture.owner, "owner-A")
  assert.equal(fixture.inserted.length, 1)
  assert.equal(fixture.inserted[0].egov_uniqid, "citizen-B")
  assert.notEqual(fixture.inserted[0].id, "owner-A", "new identity must not overwrite an existing owner's database row")
  fixture.existing = { id: "owner-B-existing", profile: {} }
  await assert.rejects(sso.GET(request), /redirect:\/dashboard\?restore=1/)
  assert.equal(fixture.owner, "owner-B-existing")
  assert.equal(fixture.inserted.length, 1, "returning identity uses only its existing mapping")
})

test("real store: no blur retention, explicit consent, reload, deletion, owner switch and stale-write rejection", async () => {
  const disk = new Disk()
  Object.assign(globalThis, { localStorage: disk })
  const fixture = { owner: "A", failScope: false, switchDuringPull: false, pushCount: 0 }
  Object.assign(globalThis, { __hermitStoreTest: fixture })
  const sync = dataModule(`
    const f = globalThis.__hermitStoreTest;
    export const currentOwnerId = async () => { if (f.failScope) throw Error('offline'); return f.owner; };
    export const pullState = async () => { if (f.switchDuringPull) { f.owner = 'C'; f.switchDuringPull = false; } return null; };
    export const pushOwner = async () => { f.pushCount++; return true; };
    export const saveDocuments = async () => true;
    export const appendVaultEvents = async () => true;
    export const deleteDocument = async () => true;
    export const clearChat = async () => true;
  `)
  const imports = {
    "@/app/sync": sync,
    react: dataModule(
      "export const useSyncExternalStore = (_, read) => read(); export const useEffect = () => {};"
    ),
    "next/navigation": dataModule(
      "export const useRouter = () => ({ replace() {} });"
    ),
    "./files": dataModule("export const deleteFile = async () => {};"),
  }
  disk.setItem(
    "hermit:v1",
    JSON.stringify({
      profile: { ...EMPTY_PROFILE, ownerName: "Unscoped other person" },
    })
  )
  let store = await loadModule("./store.ts", imports)
  assert.equal(
    store.useHermit().profile,
    null,
    "no unverified owner data is shown before hydration"
  )
  await new Promise(setImmediate)
  assert.equal(store.useHermit().ownerId, "A")
  assert.equal(
    store.useHermit().profile,
    null,
    "unscoped legacy profile must not be attributed to A"
  )
  store.update(() => ({ profile: { ...EMPTY_PROFILE, ownerName: "Owner A" } }))
  store.setFormAnswer("dti_bn", "email", "a@example.test")
  store.setFormAnswer("dti_bn", "tin", "private-identifier")
  store.update(() => ({
    pdfDrafts: { draft: [{ image: "private-signature" }] },
  }))
  assert.doesNotMatch(
    disk.getItem(ownerStateKey("A"))!,
    /private-identifier|private-signature|a@example\.test/
  )
  await store.hydrate()
  assert.equal(store.useHermit().formEdits.dti_bn.email, "a@example.test", "rechecking the same owner keeps current-form edits")
  assert.ok(store.useHermit().pdfDrafts.draft, "rechecking the same owner keeps session PDF edits")
  await store.saveFormAnswers({ email: "a@example.test" }, false, "dti_bn")
  assert.equal(
    disk.getItem(memoryKey("A")),
    null,
    "declining leaves persistence untouched"
  )
  await store.saveFormAnswers(
    { email: "a@example.test", tin: "private-identifier" },
    true,
    "dti_bn"
  )
  assert.equal(loadFormMemory(disk, "A").answers.email!.value, "a@example.test")
  assert.doesNotMatch(disk.getItem(memoryKey("A"))!, /private-identifier/)
  // Retire the previous module's pending owner sync, preserving disk for reload.
  await new Promise((resolve) => setTimeout(resolve, 850))
  store = await loadModule("./store.ts", imports)
  store.useHermit()
  await new Promise(setImmediate)
  assert.equal(store.useHermit().profile.ownerName, "Owner A")
  assert.deepEqual(store.useHermit().formEdits, {})
  assert.deepEqual(store.useHermit().pdfDrafts, {})
  assert.equal(
    store.useHermit().formMemory.answers.email.value,
    "a@example.test"
  )
  await store.editSavedAnswer("email", "edited@example.test")
  assert.equal(
    loadFormMemory(disk, "A").answers.email!.value,
    "edited@example.test"
  )
  await store.editSavedAnswer("email", "")
  assert.equal(loadFormMemory(disk, "A").answers.email, undefined)
  await store.saveFormAnswers({ email: "a@example.test" }, true, "dti_bn")
  await store.withdrawFormConsent()
  assert.equal(disk.getItem(memoryKey("A")), null)
  await store.saveFormAnswers({ email: "a@example.test" }, false, "dti_bn")
  assert.equal(
    disk.getItem(memoryKey("A")),
    null,
    "declining after withdrawal cannot recreate consent"
  )
  await store.saveFormAnswers({ email: "a@example.test" }, true, "dti_bn")
  fixture.owner = "B"
  await assert.rejects(
    store.saveFormAnswers(
      { email: "should-not-leak@example.test" },
      true,
      "other"
    ),
    /Account changed/
  )
  await assert.rejects(store.withdrawFormConsent(), /Account changed/)
  assert.equal(disk.getItem(memoryKey("B")), null)
  await store.hydrate()
  assert.equal(store.useHermit().ownerId, "B")
  assert.equal(store.useHermit().profile, null)
  assert.deepEqual(store.useHermit().formMemory.answers, {})
  assert.deepEqual(store.useHermit().formEdits, {})
  assert.deepEqual(store.useHermit().pdfDrafts, {})
  await store.saveFormAnswers({ email: "b@example.test" }, true, "other")
  assert.equal(loadFormMemory(disk, "A").answers.email!.value, "a@example.test")
  assert.equal(loadFormMemory(disk, "B").answers.email!.value, "b@example.test")
  await store.withdrawFormConsent()
  assert.equal(
    loadFormMemory(disk, "A").answers.email!.value,
    "a@example.test",
    "B's withdrawal cannot delete A's answers"
  )
  fixture.failScope = true
  await store.hydrate()
  assert.equal(store.useHermit().profile, null)
  assert.match(store.useHermit().scopeError, /verify your account/)
  fixture.failScope = false
  await store.hydrate()
  assert.equal(store.useHermit().ownerId, "B")
  fixture.switchDuringPull = true
  await store.hydrate()
  assert.equal(store.useHermit().ownerId, null, "a switch during hydration must not expose the old profile or answers")
  assert.match(store.useHermit().scopeError, /Account changed/)
  await store.hydrate()
  assert.equal(store.useHermit().ownerId, "C")
  assert.deepEqual(store.useHermit().formMemory.answers, {})
  store.clearAll()
  assert.equal(
    loadFormMemory(disk, "A").answers.email!.value,
    "a@example.test",
    "delete-all is scoped to the active owner"
  )
})

test("real server sync actions reject stale owners before accessing the database", async () => {
  const fixture = { owner: "B", accessed: 0 }
  Object.assign(globalThis, { __hermitSyncTest: fixture })
  const sync = await loadModule("../app/sync.ts", {
    "@/lib/db": dataModule(
      "export const BUCKET = 'documents'; export const db = () => { globalThis.__hermitSyncTest.accessed++; return null; };"
    ),
    "@/lib/session": dataModule(
      "export const ownerId = async () => globalThis.__hermitSyncTest.owner; export const clearSession = async () => {};"
    ),
  })
  await assert.rejects(
    sync.pushOwner({ profile: EMPTY_PROFILE, items: {}, lastDiff: null }, "A"),
    /Account changed/
  )
  await assert.rejects(sync.saveDocuments([], "A"), /Account changed/)
  await assert.rejects(sync.appendVaultEvents([], "A"), /Account changed/)
  await assert.rejects(
    sync.deleteDocument("00000000-0000-0000-0000-000000000000", "A"),
    /Account changed/
  )
  await assert.rejects(sync.clearChat("A"), /Account changed/)
  await assert.rejects(sync.deleteAllData("A"), /Account changed/)
  assert.equal(fixture.accessed, 0)
  await sync.pushOwner(
    { profile: EMPTY_PROFILE, items: {}, lastDiff: null },
    "B"
  )
  assert.equal(
    fixture.accessed,
    1,
    "matching owner retains the no-backend path"
  )
})

test("rendered field sheet has an unchecked consent choice and editable profile-derived values", async () => {
  const { createElement } = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  const profile = { ...EMPTY_PROFILE, ownerName: "Editable Owner" }
  const store = dataModule(
    `export const useProfile = () => (${JSON.stringify({ ownerId: "A", profile, formMemory: { consentedAt: null, answers: {} }, formEdits: {} })}); export const useHermit = useProfile; export const saveFormAnswers = async () => {}; export const setFormAnswer = () => {}; export const update = () => {};`
  )
  const consent = await loadModule("../components/form-consent.tsx", {
    "@/lib/store": store,
    "@/lib/form-memory": new URL("./form-memory.ts", import.meta.url).href,
    "next/link": dataModule("export default function Link() { return null; }"),
  })
  Object.assign(globalThis, { __hermitConsentHook: consent.useFormConsent })
  const sheet = await loadModule("../components/form-sheet.tsx", {
    "@/lib/store": store,
    "@/lib/forms": new URL("./forms.ts", import.meta.url).href,
    "@/lib/library": dataModule("export const libraryFiles = () => [];"),
    "@/components/form-consent": dataModule(
      "export const useFormConsent = (...args) => globalThis.__hermitConsentHook(...args);"
    ),
    "@/components/ui/button": dataModule(
      "export function Button() { return null; } export const buttonVariants = () => '';"
    ),
    "next/link": dataModule("export default function Link() { return null; }"),
  })
  const html = renderToStaticMarkup(
    createElement(sheet.FormSheet, { id: "dti_bn" })
  )
  assert.match(html, /type="checkbox"/)
  assert.doesNotMatch(html, /checked=""/)
  assert.match(
    html,
    /<input[^>]*aria-label="Owner \/ taxpayer name"[^>]*value="Editable Owner"/
  )
  assert.match(html, /Optional\. Leave unchecked/)
})
