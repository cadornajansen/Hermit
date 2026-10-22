import assert from "node:assert/strict"
import { test } from "node:test"

import { EMPTY_PROFILE } from "./engine.ts"
import {
  answersFromBoxes,
  draftKey,
  initialBoxes,
  type Box,
  type Layout,
} from "./fill.ts"
import {
  editRememberedAnswer,
  eligibleAnswers,
  emptyFormMemory,
  loadFormMemory,
  matchReusableField,
  memoryKey,
  persistFormMemory,
  rememberAnswers,
} from "./form-memory.ts"
import { fillForm, getForm } from "./forms.ts"

const now = "2026-10-23T09:00:00.000Z"
function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
  }
}

test("consent must be an explicit boolean true, even when previously granted", () => {
  const empty = emptyFormMemory()
  for (const consent of [false, undefined, null, "true", 1, {}])
    assert.equal(
      rememberAnswers(empty, consent, { email: "a@example.test" }, "one", now),
      empty
    )
  const saved = rememberAnswers(
    empty,
    true,
    { email: "a@example.test" },
    "one",
    now
  )
  assert.equal(
    rememberAnswers(saved, false, { email: "b@example.test" }, "two"),
    saved
  )
  assert.deepEqual(saved.answers.email, {
    value: "a@example.test",
    updatedAt: now,
    sourceForm: "one",
  })
})

test("matching accepts reviewed label aliases, punctuation and case, never ambiguous or other-person labels", () => {
  for (const label of [
    "business_name",
    "  REGISTERED BUSINESS NAME ",
    "Business / trade name",
  ])
    assert.equal(matchReusableField(label), "business_name")
  assert.equal(matchReusableField("E-mail address"), "email")
  assert.equal(matchReusableField("Owner / taxpayer name"), "owner_name")
  for (const label of [
    "Name",
    "Address",
    "Employee name",
    "Spouse email",
    "Property owner name",
    "Beneficiary mobile",
    "Taxpayer identification number",
    "Password",
  ])
    assert.equal(matchReusableField(label), undefined, label)
})

test("sensitive, financial, temporal, unknown, empty and oversized answers are excluded", () => {
  const values = {
    email: " person@example.test ",
    password: "secret",
    otp: "123456",
    tin: "123-456-789",
    dti_no: "123",
    sss_er_no: "123",
    philhealth_er_no: "123",
    pagibig_er_no: "123",
    birth_date: "1980-01-01",
    signature: "ink",
    capital: "100",
    gross_sales: "200",
    total_assets: "500",
    sales_band: "under 500k",
    tax_option: "8pct",
    period: "Q1",
    reason: "private reason",
    products: "private",
    custom: "secret",
    mobile: " ",
    activity: "x".repeat(501),
  }
  assert.deepEqual(eligibleAnswers(values), { email: "person@example.test" })
  const saved = rememberAnswers(emptyFormMemory(), true, values, "one", now)
  assert.deepEqual(Object.keys(saved.answers), ["email"])
})

test("contradictory aliases are left unresolved instead of choosing the last answer", () => {
  assert.deepEqual(
    eligibleAnswers({
      email: "a@example.test",
      "Email address": "b@example.test",
      business_name: "Shop",
    }),
    { business_name: "Shop" }
  )
})

test("consented information persists across reloads and is scoped to the owner", () => {
  const disk = storage()
  const a = rememberAnswers(
    emptyFormMemory(),
    true,
    { email: "a@example.test" },
    "one",
    now
  )
  persistFormMemory(disk, "A", a)
  assert.deepEqual(loadFormMemory(disk, "A"), a)
  assert.deepEqual(loadFormMemory(disk, "B"), emptyFormMemory())
  disk.setItem(memoryKey("B"), disk.getItem(memoryKey("A"))!)
  assert.deepEqual(loadFormMemory(disk, "B"), emptyFormMemory())
})

test("corrupt, unconsented and legacy sensitive data cannot become reusable on hydration", () => {
  const disk = storage()
  for (const record of [
    "{",
    JSON.stringify({
      ownerId: "A",
      consentedAt: null,
      answers: { email: { value: "old@example.test" } },
    }),
  ]) {
    disk.setItem(memoryKey("A"), record)
    assert.deepEqual(loadFormMemory(disk, "A"), emptyFormMemory())
  }
  disk.setItem(
    memoryKey("A"),
    JSON.stringify({
      ownerId: "A",
      consentedAt: now,
      answers: {
        tin: { value: "123", updatedAt: now, sourceForm: "old" },
        email: { value: "a@example.test", updatedAt: now, sourceForm: "one" },
      },
    })
  )
  assert.deepEqual(Object.keys(loadFormMemory(disk, "A").answers), ["email"])
})

test("saved answers reach later forms, missing answers remain blank, and conflicts are visible", () => {
  const memory = rememberAnswers(
    emptyFormMemory(),
    true,
    { email: "saved@example.test", owner_name: "Saved Owner" },
    "first",
    now
  )
  const fields = fillForm(
    getForm("dti_bn")!,
    { ...EMPTY_PROFILE, ownerName: "Account Owner" },
    memory
  )
  const owner = fields.find((f) => f.key === "owner_name")!
  assert.equal(owner.value, "Account Owner")
  assert.equal(owner.source, "account")
  assert.equal(owner.conflict, true)
  assert.equal(owner.saved, "Saved Owner")
  assert.equal(
    fields.find((f) => f.key === "email")!.value,
    "saved@example.test"
  )
  assert.equal(fields.find((f) => f.key === "email")!.source, "saved answer")
  assert.equal(fields.find((f) => f.key === "mobile")!.missing, true)
  assert.equal(
    fillForm(getForm("sss_r1")!, EMPTY_PROFILE, memory).find(
      (f) => f.key === "email"
    )!.value,
    "saved@example.test"
  )
})

test("editing or clearing a pre-filled value survives later account and saved-information changes", () => {
  const memory = rememberAnswers(
    emptyFormMemory(),
    true,
    { email: "saved@example.test" },
    "first",
    now
  )
  for (const current of ["typed@example.test", ""]) {
    const fields = fillForm(
      getForm("dti_bn")!,
      { ...EMPTY_PROFILE, email: "new-account@example.test" },
      memory,
      { email: current }
    )
    assert.equal(fields.find((f) => f.key === "email")!.value, current)
    assert.equal(fields.find((f) => f.key === "email")!.source, "current form")
  }
})

test("review updates and individual deletion persist; withdrawal removes storage and stops future reuse", () => {
  const disk = storage()
  let memory = rememberAnswers(
    emptyFormMemory(),
    true,
    { email: "a@example.test", mobile: "09170000000" },
    "one",
    now
  )
  memory = editRememberedAnswer(memory, "email", "b@example.test", now)
  memory = editRememberedAnswer(memory, "mobile", "", now)
  persistFormMemory(disk, "A", memory)
  assert.equal(loadFormMemory(disk, "A").answers.email!.value, "b@example.test")
  assert.equal(loadFormMemory(disk, "A").answers.mobile, undefined)
  persistFormMemory(disk, "A", emptyFormMemory())
  assert.equal(disk.getItem(memoryKey("A")), null)
  assert.equal(
    fillForm(getForm("dti_bn")!, EMPTY_PROFILE, loadFormMemory(disk, "A")).find(
      (f) => f.key === "email"
    )!.value,
    ""
  )
  assert.throws(() =>
    editRememberedAnswer(emptyFormMemory(), "email", "c@example.test")
  )
})

test("full business address preserves province context from the audit", () => {
  const fields = fillForm(getForm("dti_bn")!, {
    ...EMPTY_PROFILE,
    businessAddress: "1 Example Street",
    city: "San Jose",
    province: "Tarlac",
  })
  assert.equal(
    fields.find((f) => f.key === "business_address")!.value,
    "1 Example Street, San Jose, Tarlac"
  )
})

test("PDF correction reuse uses whole mapped values, excludes split names and ambiguous duplicates", () => {
  const layout: Layout = {
    formId: "one",
    sha256: "hash",
    fillable: false,
    pages: [],
    entries: [
      { key: "owner_name", part: "first", page: 0, x: 0, y: 0, size: 10 },
      { key: "email", page: 0, x: 0, y: 10, size: 10 },
      { key: "tin", page: 0, x: 0, y: 20, size: 10 },
    ],
  }
  const boxes = initialBoxes(layout, {
    owner_name: "Juana Reyes",
    email: "before@example.test",
    tin: "123",
  }).boxes
  boxes.find((b) => b.key === "email")!.text = "corrected@example.test"
  boxes.push({
    id: "signature",
    kind: "signature",
    image: "private",
    text: "",
    page: 0,
    x: 0,
    y: 0,
    size: 10,
  })
  assert.deepEqual(eligibleAnswers(answersFromBoxes(boxes)), {
    email: "corrected@example.test",
  })
  boxes.push({
    ...boxes.find((b) => b.key === "email")!,
    id: "conflict",
    text: "different@example.test",
  } as Box)
  assert.deepEqual(eligibleAnswers(answersFromBoxes(boxes)), {})
  assert.notEqual(
    draftKey("A", "form.pdf", layout),
    draftKey("B", "form.pdf", layout)
  )
  assert.notEqual(
    draftKey("A", "form.pdf", layout),
    draftKey("A", "form.pdf", { ...layout, sha256: "new" })
  )
})

test("storage failures surface instead of claiming persistence or deletion", () => {
  const disk = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota")
    },
    removeItem: () => {
      throw new Error("blocked")
    },
  }
  const memory = rememberAnswers(
    emptyFormMemory(),
    true,
    { email: "a@example.test" },
    "one",
    now
  )
  assert.throws(() => persistFormMemory(disk, "A", memory), /quota/)
  assert.throws(
    () => persistFormMemory(disk, "A", emptyFormMemory()),
    /blocked/
  )
})
