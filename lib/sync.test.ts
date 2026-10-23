import assert from "node:assert/strict"
import { test } from "node:test"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"
import { EMPTY_PROFILE } from "./engine.ts"
import { ownerStateKey } from "./form-memory.ts"
import { EMPTY_EXTRACTED } from "./vault.ts"

const owner = "00000000-0000-4000-8000-000000000001"
const state = (name: string) => ({ profile: { ...EMPTY_PROFILE, ownerName: name }, items: {}, lastDiff: null, docs: [], vaultLog: [], chat: [] })

test("sync actions reject database errors rather than acknowledge success", async () => {
  const fixture = { failure: "owners:upsert", emptyRows: false, backend: true, events: [] as unknown[], inserts: 0 }
  Object.assign(globalThis, { __hermitSyncDb: fixture })
  const sync = await loadRuntime("app/sync.ts", {
    "@/lib/session": dataModule(`export const ownerId=async()=>${JSON.stringify(owner)};export const clearSession=async()=>{};`),
    "@/lib/db": dataModule(`
      export const BUCKET='synthetic';
      const f=globalThis.__hermitSyncDb;
      export const db=()=>!f.backend?null:({
        from(table){
          let op='',payload;
          const q={then(resolve){
            const failed=f.failure===table+':'+op;
            if(!failed&&table==='vault_events'&&op==='insert'){f.events.push(...payload);f.inserts++}
            const data=op==='select'?(table==='owners'?{profile:null}:table==='vault_events'?f.events:[]):op==='update'?(f.emptyRows?[]:[{id:'synthetic'}]):null;
            return Promise.resolve({error:failed?{message:'Synthetic DB error'}:null,data}).then(resolve);
          }};
          for(const method of ['upsert','update','insert','delete'])q[method]=value=>{op=method;payload=value;return q};
          q.select=()=>{op||='select';return q};
          for(const method of ['eq','gte','maybeSingle','order','limit'])q[method]=()=>q;
          return q;
        },
        storage:{from:()=>({remove:async()=>({error:f.failure==='storage:remove'?{message:'Synthetic storage error'}:null})})}
      });
    `),
  })
  await assert.rejects(sync.pushOwner(state("Synthetic"), owner), /sync|save|account/i)
  fixture.failure = "owners:update"
  await assert.rejects(sync.pushOwner(state("Synthetic"), owner), /sync|save|account/i)
  fixture.failure = "owners:select"
  await assert.rejects(sync.pullState(owner), /restore/)
  fixture.failure = "documents:select"
  await assert.rejects(sync.pullState(owner), /restore/)
  fixture.failure = "chat_messages:delete"
  await assert.rejects(sync.clearChat(owner), /sync|save|account/i)
  const events = [{ docId: owner, docName: "Synthetic", event: "Synthetic", at: "2026-10-23T00:00:00Z" }]
  for (const op of ["select", "insert"]) {
    fixture.failure = `vault_events:${op}`
    await assert.rejects(sync.appendVaultEvents(events, owner), /sync|save|account/i)
  }
  fixture.failure = "storage:remove"
  await assert.rejects(sync.deleteDocument(owner, owner), /sync|save|account/i)
  fixture.failure = "documents:delete"
  await assert.rejects(sync.deleteDocument(owner, owner), /sync|save|account/i)
  fixture.failure = "documents:upsert"
  await assert.rejects(sync.saveDocuments([{ id: owner, verdict: "needs_review", extracted: EMPTY_EXTRACTED, fileName: "Synthetic", mime: "application/pdf", size: 1, sha256: "synthetic", uploadedAt: "2026-10-23", checks: [], expectedTypes: [] }], owner), /sync|save|account/i)
  fixture.failure = ""
  fixture.emptyRows = true
  await assert.rejects(sync.pushOwner(state("Synthetic"), owner), /no row was acknowledged/)
  fixture.emptyRows = false
  assert.equal(await sync.pushOwner(state("Synthetic"), owner), true)
  await sync.appendVaultEvents(events, owner)
  await sync.appendVaultEvents(events, owner)
  assert.equal(fixture.inserts, 1, "retries do not duplicate already acknowledged audit entries")
  fixture.backend = false
  assert.equal(await sync.pushOwner(state("Synthetic"), owner), false)
})

test("pending profile writes survive failure/reload and retry; acknowledged server values stay intact", async (t) => {
  t.mock.method(console, "warn", () => {})
  const disk = new Map<string, string>()
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value), removeItem: (key: string) => disk.delete(key) } })
  const fixture = { owner, server: state("Acknowledged server update"), fail: false, pushes: 0, documents: [] as string[], deleted: [] as string[], events: [] as unknown[], clears: 0, hold: false, release: () => {} }
  Object.assign(globalThis, { __hermitSyncStore: fixture })
  const stubs = {
    react: dataModule("export const useSyncExternalStore=(_,read)=>read();export const useEffect=()=>{};"),
    "next/navigation": dataModule("export const useRouter=()=>({replace(){}});"),
    "./files": dataModule("export const deleteFile=async()=>{};"),
    "@/app/sync": dataModule(`const f=globalThis.__hermitSyncStore;const check=()=>{if(f.fail)throw Error('offline')};export const currentOwnerId=async()=>f.owner;export const pullState=async()=>{check();return f.server};export const pushOwner=async(s)=>{f.pushes++;check();if(f.hold)await new Promise(resolve=>{f.release=resolve});f.server={...f.server,...s};return true};export const saveDocuments=async(docs)=>{check();f.documents.push(...docs.map(d=>d.id));return true};export const appendVaultEvents=async(events)=>{check();f.events.push(...events);return true};export const deleteDocument=async(id)=>{check();f.deleted.push(id);return true};export const clearChat=async()=>{check();f.clears++;return true};`),
  }
  disk.set(ownerStateKey(owner), JSON.stringify({ ownerId: owner, ...state("Local working copy") }))
  let store = await loadRuntime("lib/store.ts", stubs)
  store.useHermit()
  await new Promise(setImmediate)
  assert.equal(store.useHermit().profile.ownerName, "Local working copy")
  assert.equal(fixture.server.profile.ownerName, "Acknowledged server update")
  assert.equal(fixture.pushes, 0, "hydration does not overwrite an acknowledged server copy")
  fixture.fail = true
  store.update(() => ({ profile: { ...EMPTY_PROFILE, ownerName: "Pending local edit" } }))
  assert.ok(JSON.parse(disk.get(ownerStateKey(owner))!).pendingSync?.owner, "queue is durable before the debounce")
  await new Promise((resolve) => setTimeout(resolve, 850))
  assert.ok(store.useHermit().syncError)
  store = await loadRuntime("lib/store.ts", stubs)
  store.useHermit()
  await new Promise(setImmediate)
  assert.equal(store.useHermit().profile.ownerName, "Pending local edit")
  assert.ok(store.useHermit().syncError)
  fixture.fail = false
  await store.hydrate()
  await new Promise(setImmediate)
  assert.equal(fixture.server.profile.ownerName, "Pending local edit")
  assert.equal(store.useHermit().pendingSync?.owner, undefined)
  assert.equal(store.useHermit().syncError, undefined)

  // Newer edits made while a previous write is in flight need their own acknowledgement.
  fixture.hold = true
  store.update(() => ({ profile: { ...EMPTY_PROFILE, ownerName: "First in flight" } }))
  const flushing = store.flushSync()
  await new Promise(setImmediate)
  store.update(() => ({ profile: { ...EMPTY_PROFILE, ownerName: "Newer pending edit" } }))
  fixture.hold = false
  fixture.release()
  await flushing
  assert.equal(fixture.server.profile.ownerName, "Newer pending edit")
  assert.equal(store.useHermit().pendingSync.owner, undefined)

  const oldDoc = { id: owner, extracted: EMPTY_EXTRACTED, checks: [], verdict: "needs_review", uploadedAt: "2026-10-23", fileName: "Synthetic", expectedTypes: [], sha256: "synthetic", mime: "application/pdf", size: 1, ownerConfirmed: false }
  store.update(() => ({ docs: [oldDoc], chat: [{ role: "owner", text: "Synthetic", at: "2026-10-23" }] }))
  await store.flushSync()
  fixture.fail = true
  const newDoc = { ...oldDoc, id: "00000000-0000-4000-8000-000000000002" }
  const event = { docId: newDoc.id, docName: "Synthetic", event: "Synthetic upload", at: "2026-10-23T00:00:00Z" }
  store.update(() => ({ docs: [newDoc], vaultLog: [event], chat: [] }))
  await store.flushSync()
  store = await loadRuntime("lib/store.ts", stubs)
  store.useHermit()
  await new Promise(setImmediate)
  const queued = store.useHermit().pendingSync
  assert.ok(queued.documents[newDoc.id])
  assert.ok(queued.deleted[oldDoc.id])
  assert.deepEqual(queued.events, [event])
  assert.ok(queued.clearChat)
  fixture.fail = false
  await store.hydrate()
  assert.ok(fixture.documents.includes(newDoc.id))
  assert.deepEqual(fixture.deleted, [oldDoc.id])
  assert.deepEqual(fixture.events, [event])
  assert.equal(fixture.clears, 1)
  assert.deepEqual(store.useHermit().pendingSync.documents, {})
  assert.deepEqual(store.useHermit().pendingSync.deleted, {})
  assert.deepEqual(store.useHermit().pendingSync.events, [])
  assert.equal(store.useHermit().pendingSync.clearChat, undefined)

  // Restore cannot discard an edit that has not been acknowledged yet.
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  const previousHistory = Object.getOwnPropertyDescriptor(globalThis, "history")
  Object.defineProperty(globalThis, "location", { value: { search: "?restore=1", pathname: "/dashboard" }, configurable: true })
  Object.defineProperty(globalThis, "history", { value: { replaceState() {} }, configurable: true })
  try {
    fixture.fail = true
    store.update(() => ({ profile: { ...EMPTY_PROFILE, ownerName: "Pending through restore" } }))
    await store.hydrate()
    assert.equal(store.useHermit().profile.ownerName, "Pending through restore")
    assert.ok(store.useHermit().pendingSync.owner)
    fixture.fail = false
    await store.hydrate()
    assert.equal(fixture.server.profile.ownerName, "Pending through restore")
    assert.equal(store.useHermit().profile.ownerName, "Pending through restore")
    assert.equal(store.useHermit().pendingSync.owner, undefined)
  } finally {
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location")
    if (previousHistory) Object.defineProperty(globalThis, "history", previousHistory); else Reflect.deleteProperty(globalThis, "history")
  }
})
