// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { readExif } from "./exif.ts"

// Minimal little-endian EXIF JPEG: IFD0 → Exif IFD (DateTimeOriginal) + GPS IFD.
function photo() {
  const t = new DataView(new ArrayBuffer(400))
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    t.setUint16(at, tag, true)
    t.setUint16(at + 2, type, true)
    t.setUint32(at + 4, count, true)
    t.setUint32(at + 8, value, true)
  }
  t.setUint16(0, 0x4949)
  t.setUint16(2, 42, true)
  t.setUint32(4, 8, true)
  t.setUint16(8, 2, true) // IFD0 at 8
  entry(10, 0x8769, 4, 1, 40)
  entry(22, 0x8825, 4, 1, 80)
  t.setUint16(40, 1, true) // Exif IFD at 40
  entry(42, 0x9003, 2, 20, 200)
  ;[..."2026:10:22 10:15:43\0"].forEach((c, i) => t.setUint8(200 + i, c.charCodeAt(0)))
  t.setUint16(80, 4, true) // GPS IFD at 80
  entry(82, 1, 2, 2, "N".charCodeAt(0))
  entry(94, 2, 5, 3, 240)
  entry(106, 3, 2, 2, "E".charCodeAt(0))
  entry(118, 4, 5, 3, 270)
  ;[[14, 1], [35, 1], [2400, 100]].forEach(([n, d], i) => (t.setUint32(240 + i * 8, n, true), t.setUint32(244 + i * 8, d, true)))
  ;[[121, 1], [2, 1], [600, 100]].forEach(([n, d], i) => (t.setUint32(270 + i * 8, n, true), t.setUint32(274 + i * 8, d, true)))
  const head = [0xff, 0xd8, 0xff, 0xe1, 0x01, 0x9a, 0x45, 0x78, 0x69, 0x66, 0, 0]
  const out = new Uint8Array(head.length + 400)
  out.set(head)
  out.set(new Uint8Array(t.buffer), head.length)
  return out.buffer
}

test("reads when and where a photo was taken", () => {
  assert.deepEqual(readExif(photo()), { takenAt: "2026-10-22T10:15", lat: 14.59, lng: 121.035 })
})

test("non-JPEG or photos without EXIF give nothing", () => {
  assert.deepEqual(readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), {})
  assert.deepEqual(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), {})
})
