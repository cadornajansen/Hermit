// Reads when and where a JPEG photo was taken (EXIF DateTimeOriginal + GPS),
// on the device. Enough for an eReport's "when / where"; nothing else.

export type PhotoMeta = { takenAt?: string; lat?: number; lng?: number }

export function readExif(buf: ArrayBuffer): PhotoMeta {
  const v = new DataView(buf)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return {}
  let o = 2
  while (o + 4 < v.byteLength) {
    const marker = v.getUint16(o)
    const len = v.getUint16(o + 2)
    if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return tiff(v, o + 10) // "Exif"
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break
    o += 2 + len
  }
  return {}
}

function tiff(v: DataView, start: number): PhotoMeta {
  const le = v.getUint16(start) === 0x4949
  const u16 = (o: number) => v.getUint16(start + o, le)
  const u32 = (o: number) => v.getUint32(start + o, le)
  const ifd = (o: number) => {
    const tags = new Map<number, { type: number; count: number; at: number }>()
    for (let i = 0, n = u16(o); i < n; i++) {
      const e = o + 2 + i * 12
      const type = u16(e + 2)
      const count = u32(e + 4)
      const size = count * ({ 2: 1, 3: 2, 4: 4, 5: 8 }[type] ?? 1)
      tags.set(u16(e), { type, count, at: size > 4 ? u32(e + 8) : e + 8 })
    }
    return tags
  }
  const ascii = (t?: { count: number; at: number }) => (t ? Array.from({ length: t.count }, (_, i) => String.fromCharCode(v.getUint8(start + t.at + i))).join("").replace(/\0+$/, "") : "")
  const rational = (at: number, i: number) => u32(at + i * 8) / (u32(at + i * 8 + 4) || 1)
  const dms = (t?: { at: number }) => (t ? rational(t.at, 0) + rational(t.at, 1) / 60 + rational(t.at, 2) / 3600 : undefined)

  const out: PhotoMeta = {}
  const root = ifd(u32(4))
  const exif = root.get(0x8769)
  if (exif) {
    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/.exec(ascii(ifd(u32(exif.at)).get(0x9003)))
    if (m) out.takenAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`
  }
  const gps = root.get(0x8825)
  if (gps) {
    const g = ifd(u32(gps.at))
    const lat = dms(g.get(2))
    const lng = dms(g.get(4))
    if (lat !== undefined && lng !== undefined && (lat || lng)) {
      out.lat = Math.round((ascii(g.get(1)) === "S" ? -lat : lat) * 1e5) / 1e5
      out.lng = Math.round((ascii(g.get(3)) === "W" ? -lng : lng) * 1e5) / 1e5
    }
  }
  return out
}
