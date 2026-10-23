import assert from "node:assert/strict"
import { test } from "node:test"

import { storageKeyForAccount } from "./account-storage.ts"

test("guests retain the existing browser storage key", () => {
  assert.equal(storageKeyForAccount(null), "hermit:v1")
})

test("a signed-in account receives its own stable storage key", () => {
  const userId = "58bb04ed-df33-47aa-968c-20a6028f54af"

  assert.equal(storageKeyForAccount(userId), `hermit:v1:account:${userId}`)
  assert.equal(storageKeyForAccount(userId), storageKeyForAccount(userId))
  assert.notEqual(storageKeyForAccount(userId), storageKeyForAccount(null))
})

test("different accounts never share the same storage key", () => {
  const firstUserId = "58bb04ed-df33-47aa-968c-20a6028f54af"
  const secondUserId = "fce7bed2-d4f2-4a75-98e7-a34e7be17181"

  assert.notEqual(
    storageKeyForAccount(firstUserId),
    storageKeyForAccount(secondUserId)
  )
})
