import assert from "node:assert/strict"
import { test } from "node:test"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"
import { EMPTY_PROFILE } from "./engine.ts"
import { formForLocation, getForm } from "./forms.ts"
import { processFor } from "./processes.ts"
import { officesFor } from "./offices.ts"

const cebu = { ...EMPTY_PROFILE, city: "Cebu City", province: "Cebu", region: "Central Visayas (Region VII)", lang: "en" as const, premises: "owned" as const }
const taguig = { ...EMPTY_PROFILE, city: "Taguig", region: "NCR" }
test("LGU links require a matching canonical jurisdiction and filing task", () => {
  for (const location of [cebu, { ...EMPTY_PROFILE, city: "San Jose" }, { ...taguig, region: "Central Luzon (Region III)" }, { ...taguig, province: "Tarlac" }, EMPTY_PROFILE]) {
    for (const id of ["mayors_permit", "mayors_renewal", "sanitary_permit"]) {
      const process = processFor(id, location)!
      assert.doesNotMatch(JSON.stringify([process.links, process.office, process.note]), /taguig/i)
      assert.ok(process.office)
      if (id.startsWith("mayors")) assert.match(process.note!, /Confirm/)
    }
    assert.equal(formForLocation(getForm("lgu_permit")!, location).files, undefined)
    assert.doesNotMatch(formForLocation(getForm("zoning")!, location).source, /taguig/i)
    assert.deepEqual(officesFor(location.city, "", new Set(["bplo"]), location), [])
  }
  assert.match(JSON.stringify(processFor("mayors_permit", taguig)), /tlcportal\.taguig/)
  assert.match(JSON.stringify(processFor("mayors_renewal", taguig)), /renewal/)
  assert.doesNotMatch(JSON.stringify(processFor("mayors_permit", taguig, "update")!.links), /taguig/i)
  assert.match(processFor("mayors_permit", taguig)!.jurisdiction!, /City of Taguig/)
  assert.match(processFor("bir_cor", taguig, "update")!.links[0].label, /update/)
  assert.match(processFor("bir_cor", taguig, "abatement")!.office!, /2121/)
})

test("Cebu packet has local context and general guidance, without Taguig links or forms", async (t) => {
  // A stored Taguig PDF is deliberately offered by the manifest boundary.
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Cebu packet must not fetch a Taguig PDF") })
  const { packetPlan, buildPacket } = await loadRuntime("lib/pack.ts", {
    "./library": dataModule("export const libraryFiles=(id,p)=>id==='lgu_permit'&&p.city==='Taguig'?[{kind:'form',path:'lgu_permit/taguig.pdf',url:'https://synthetic.invalid/taguig.pdf'}]:[];"),
  })
  const plan = packetPlan("mayors_permit", cebu, [])
  assert.ok(plan.forms.every((form: { file?: unknown }) => !form.file))
  const { extractText } = await import("unpdf")
  const text = (await extractText(await buildPacket(plan, cebu, async () => undefined), { mergePages: true })).text
  assert.match(text, /Cebu/)
  assert.match(text, /Confirm the correct new-permit portal/)
  assert.doesNotMatch(text, /taguig/i)
})

test("official local PDF availability uses the same jurisdiction guard as guidance", async (t) => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.invalid"
  t.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous })
  const { libraryFiles } = await loadRuntime("lib/library.ts")
  assert.deepEqual(libraryFiles("lgu_permit", cebu), [])
  assert.deepEqual(libraryFiles("lgu_permit", { ...taguig, province: "Tarlac" }), [])
  assert.ok(libraryFiles("lgu_permit", taguig).length > 0)
})
