import assert from "node:assert/strict"
import { test } from "node:test"

import { validateSignIn, validateSignUp } from "./auth-validation.ts"

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

const valid = { fullName: "Ana Cruz", email: "ana@example.com", password: "correct horse", confirmPassword: "correct horse" }

test("sign-up requires a full name and a valid email", () => {
  assert.equal(validateSignUp(form({ ...valid, fullName: "  " })).ok, false)
  assert.equal(validateSignUp(form({ ...valid, email: "ana@" })).ok, false)
  assert.equal(validateSignUp(form({ ...valid, email: "" })).ok, false)
})

test("sign-up rejects short and mismatched passwords", () => {
  assert.equal(validateSignUp(form({ ...valid, password: "short", confirmPassword: "short" })).ok, false)
  assert.equal(validateSignUp(form({ ...valid, confirmPassword: "different" })).ok, false)
  assert.equal(validateSignUp(form({ ...valid, password: "", confirmPassword: "" })).ok, false)
})

test("sign-up trims display fields without changing the password", () => {
  const result = validateSignUp(form({ ...valid, fullName: " Ana Cruz ", email: " ana@example.com ", password: " keep spaces ", confirmPassword: " keep spaces " }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.fullName, "Ana Cruz")
  assert.equal(result.value.email, "ana@example.com")
  assert.equal(result.value.password, " keep spaces ")
})

test("sign-in validates missing fields without requiring a confirmation password", () => {
  assert.equal(validateSignIn(form({})).ok, false)
  assert.equal(validateSignIn(form({ email: valid.email })).ok, false)
  assert.equal(validateSignIn(form({ email: valid.email, password: valid.password })).ok, true)
})
