// Current-interface version of the support audit; synthetic data and stubs only.
import assert from "node:assert/strict"
import fs from "node:fs"
import { registerHooks } from "node:module"
import { fileURLToPath } from "node:url"

const root = new URL("../", import.meta.url)
const virtual = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true })
registerHooks({ resolve(spec, context, next) {
  if (spec === "react") return virtual("export const useSyncExternalStore=(_,read)=>read();export const useEffect=()=>{};")
  if (spec === "next/navigation") return virtual("export const useRouter=()=>({replace(){}});")
  if (spec === "@/app/sync") return virtual(`
    export const currentOwnerId=async()=>"synthetic-owner";
    export const pullState=async()=>globalThis.auditServer;
    export const pushOwner=async(state)=>{globalThis.auditPushes++;globalThis.auditServer={...globalThis.auditServer,...state};return true};
    export const saveDocuments=async()=>{};export const deleteDocument=async()=>{};
    export const appendVaultEvents=async()=>{};export const clearChat=async()=>{};
  `)
  if (spec.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const url = new URL(spec, context.parentURL)
    if (fs.existsSync(`${fileURLToPath(url)}.ts`)) return { url: `${url.href}.ts`, shortCircuit: true }
  }
  return next(spec, context)
} })
const { EMPTY_PROFILE } = await import(new URL("lib/engine.ts", root))
const { ownerStateKey } = await import(new URL("lib/form-memory.ts", root))
const state = (profile) => ({ ownerId: "synthetic-owner", profile, items: {}, docs: [], vaultLog: [], chat: [], lastDiff: null })
const local = { ...EMPTY_PROFILE, ownerName: "Synthetic local working copy" }
const remote = { ...EMPTY_PROFILE, ownerName: "Synthetic acknowledged server update" }
const disk = new Map([[ownerStateKey("synthetic-owner"), JSON.stringify(state(local))]])
globalThis.localStorage = { getItem: (key) => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: (key) => disk.delete(key) }
globalThis.auditServer = state(remote)
globalThis.auditPushes = 0
const store = await import(new URL("lib/store.ts?audit=current", root))
store.useHermit()
await new Promise(setImmediate)
assert.equal(store.useHermit().profile.ownerName, local.ownerName)
assert.equal(globalThis.auditServer.profile.ownerName, remote.ownerName)
assert.equal(globalThis.auditPushes, 0)
console.log("PASS: ordinary hydration retains the local working copy and does not overwrite the acknowledged server value")
globalThis.location = { search: "?restore=1", pathname: "/dashboard" }
globalThis.history = { replaceState() {} }
await store.hydrate()
assert.equal(store.useHermit().profile.ownerName, remote.ownerName)
console.log("PASS: explicit restore chooses the acknowledged server value")
