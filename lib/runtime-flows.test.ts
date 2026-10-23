import assert from "node:assert/strict"
import { test } from "node:test"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"
import { EMPTY_PROFILE } from "./engine.ts"
import { EMPTY_EXTRACTED } from "./vault.ts"

test("upload action accepts packet-supported MIME types and rejects WebP/HEIC with conversion guidance", async () => {
  const actions = await loadRuntime("app/actions.ts", {
    "@/lib/egov": dataModule("export const egov=()=>{throw Error('Unexpected service call')};export const isLive=()=>false;export const serviceModes=()=>({});"),
    "@/lib/db": dataModule("export const BUCKET='synthetic';export const db=()=>null;"),
    "@/lib/egov/mock": dataModule(`export const mock={ai:{extractDocument:async()=>(${JSON.stringify(EMPTY_EXTRACTED)})}};`),
    "@/lib/hermit": dataModule("export const askKuyaHermit=async()=>{};export const classifyWithHermit=async()=>{};export const extractPdfWithHermit=async()=>{};export const HERMIT_MODEL='synthetic';export const hermitEnabled=()=>false;"),
    "@/lib/ratelimit": dataModule("export const takeAiQuota=async()=>true;"),
    "@/lib/session": dataModule("export const ownerId=async()=>null;export const readSession=async()=>null;export const writeSession=async()=>{};"),
  })
  for (const type of ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"]) {
    const data = new FormData()
    data.set("file", new File(["synthetic fixture"], "synthetic", { type }))
    data.set("id", "00000000-0000-4000-8000-000000000001")
    const response = await actions.readDocument(data)
    assert.equal(response.ok, ["application/pdf", "image/png", "image/jpeg"].includes(type), type)
    if (!response.ok) assert.match(response.error, /Convert WebP, HEIC/)
  }
})

test("assistant requirement, form and official-text tools obey jurisdiction guards", async (t) => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.invalid"
  t.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous })
  const hermit = await loadRuntime("lib/hermit.ts", { "server-only": dataModule("") })
  for (const city of ["Cebu City", "Taguig"]) {
    let round = 0
    let results: string[] = []
    t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return new Response("SYNTHETIC LOCAL FORM TEXT")
      const body = JSON.parse(String(init.body))
      round++
      if (round === 1) return Response.json({ choices: [{ message: { content: null, tool_calls: [
        { id: "requirement", type: "function", function: { name: "get_requirement", arguments: JSON.stringify({ id: "mayors_permit" }) } },
        { id: "form", type: "function", function: { name: "prefill_form", arguments: JSON.stringify({ form_id: "lgu_permit" }) } },
        { id: "text", type: "function", function: { name: "read_official_form", arguments: JSON.stringify({ form_id: "lgu_permit" }) } },
      ] } }] })
      results = body.messages.filter((message: { role: string }) => message.role === "tool").map((message: { content: string }) => message.content)
      return Response.json({ choices: [{ message: { content: "Synthetic answer" } }] })
    })
    const reply = await hermit.askKuyaHermit("Synthetic permit request", [], { profile: { ...EMPTY_PROFILE, city, province: city === "Cebu City" ? "Cebu" : "", region: city === "Cebu City" ? "Central Visayas (Region VII)" : "NCR" }, items: {}, docs: [] })
    assert.equal(results.length, 3)
    if (city === "Cebu City") {
      assert.doesNotMatch(JSON.stringify([results, reply.sources]), /taguig/i)
      assert.match(results[0], /Confirm the correct new-permit portal/)
      assert.deepEqual(JSON.parse(results[1]).officialBlankForms, [])
      assert.ok(JSON.parse(results[2]).error)
    } else {
      assert.match(results[0], /tlcportal.taguig/)
      assert.ok(JSON.parse(results[1]).officialBlankForms.length > 0)
      assert.match(results[2], /SYNTHETIC LOCAL FORM TEXT/)
    }
    t.mock.restoreAll()
  }
})
