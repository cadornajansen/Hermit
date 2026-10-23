import assert from "node:assert/strict"
import { test } from "node:test"

import { documentFileError, MAX_DOCUMENT_BYTES } from "./document-upload.ts"

test("document picker accepts the same PDF, PNG and JPEG formats as the reading pipeline", () => {
  for (const type of ["application/pdf", "image/jpeg", "image/png"]) {
    assert.equal(documentFileError({ type, size: MAX_DOCUMENT_BYTES }), undefined)
  }
})

test("document picker rejects empty, oversized and unsupported files before reading", () => {
  assert.match(documentFileError({ type: "application/pdf", size: 0 })!, /empty/)
  assert.match(documentFileError({ type: "application/pdf", size: MAX_DOCUMENT_BYTES + 1 })!, /10 MB/)
  for (const type of ["image/webp", "image/heic", "image/heif", "image/svg+xml", "text/html", ""]) {
    assert.match(documentFileError({ type, size: 10 })!, /Convert WebP, HEIC/)
  }
})
