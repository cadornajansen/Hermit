// Copies every official form / guide listed in lib/forms.ts (files: [...])
// from the agency's website into Supabase Storage (public bucket "forms"),
// extracts PDF text for Kuya Hermit, and writes lib/form-files.json.
// Re-run it to check for new versions: changed files are reported by hash
// (PRD §9: "a weekly job checks source URLs for changed PDFs").
//
//   pnpm forms:sync
//
// ponytail: manual run; schedule it (Vercel Cron / GitHub Action) once
// someone owns reviewing the changes it reports.
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

import { createClient } from "@supabase/supabase-js"
import { extractText, getDocumentProxy } from "unpdf"

import { FORMS } from "../lib/forms.ts"

const MANIFEST = new URL("../lib/form-files.json", import.meta.url)
const BUCKET = "forms"
const MAX_BYTES = 20 * 1024 * 1024
const TYPES = {
  pdf: { mime: "application/pdf", magic: (b) => b.subarray(0, 5).toString() === "%PDF-" },
  xls: { mime: "application/vnd.ms-excel", magic: (b) => b.readUInt32BE(0) === 0xd0cf11e0 },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: (b) => b.readUInt32BE(0) === 0x504b0304 },
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY (pnpm forms:sync reads .env.local)")
const sb = createClient(url, key, { auth: { persistSession: false } })

const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {}
const manifest = {}
const report = { new: [], changed: [], unchanged: [], failed: [] }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

for (const form of FORMS) {
  for (const file of form.files ?? []) {
    const old = (previous[form.id] ?? []).find((e) => e.sourceUrl === file.url)
    const keepOld = (reason) => {
      report.failed.push(`${form.id}: ${file.label} — ${reason}`)
      if (old) (manifest[form.id] ??= []).push(old)
    }
    try {
      const ext = new URL(file.url).pathname.split(".").pop().toLowerCase()
      const type = TYPES[ext]
      if (!type) {
        keepOld(`unsupported file type .${ext}`)
        continue
      }
      const res = await fetch(file.url, {
        headers: { "user-agent": "Mozilla/5.0 (HERMIT forms library)" },
        signal: AbortSignal.timeout(90_000),
      })
      if (!res.ok) {
        keepOld(`HTTP ${res.status}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > MAX_BYTES) {
        keepOld(`too large (${buf.length} bytes)`)
        continue
      }
      if (!type.magic(buf)) {
        keepOld(`not a real .${ext} (got ${res.headers.get("content-type")})`)
        continue
      }

      const sha256 = createHash("sha256").update(buf).digest("hex")
      const path = `${form.id}/${slug(file.label)}.${ext}`
      const now = new Date().toISOString()
      const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: type.mime, upsert: true })
      if (up.error) {
        keepOld(`upload failed: ${up.error.message}`)
        continue
      }

      let textChars = 0
      if (ext === "pdf") {
        try {
          const { text } = await extractText(await getDocumentProxy(new Uint8Array(buf)), { mergePages: true })
          textChars = text.trim().length
          if (textChars) await sb.storage.from(BUCKET).upload(`${path}.txt`, text, { contentType: "text/plain", upsert: true })
        } catch (e) {
          console.warn(`  (no text layer for ${path}: ${e.message})`)
        }
      }

      const entry = {
        label: file.label,
        kind: file.kind,
        sourceUrl: file.url,
        path,
        contentType: type.mime,
        bytes: buf.length,
        sha256,
        textPath: textChars ? `${path}.txt` : null,
        retrievedAt: old && old.sha256 === sha256 ? old.retrievedAt : now,
        checkedAt: now,
      }
      ;(manifest[form.id] ??= []).push(entry)
      report[!old ? "new" : old.sha256 === sha256 ? "unchanged" : "changed"].push(`${form.id}: ${file.label}`)
      console.log(`✓ ${path} (${(buf.length / 1024).toFixed(0)} KB${textChars ? `, ${textChars} chars text` : ""})`)
    } catch (e) {
      keepOld(e.message)
    }
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
for (const [k, list] of Object.entries(report)) {
  console.log(`\n${k.toUpperCase()} (${list.length})`)
  for (const l of list) console.log(`  ${l}`)
}
if (report.changed.length) console.log("\n⚠ Changed files: review the new versions and update field maps in lib/forms.ts if items moved.")
