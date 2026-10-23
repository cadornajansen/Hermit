// Seeds HERMIT's wider library of business-related government forms from
// formsphilippines.com (a public aggregator that hosts copies of agency PDFs).
// Copies each PDF into Supabase Storage (public bucket "forms", under ph/),
// extracts its text for Kuya Hermit, and writes lib/forms-library.json.
//
//   pnpm forms:ph            (reads .env.local)
//
// Only business-related forms are kept (rules per agency below). Requests are
// sequential with a pause, and a re-run skips files whose hash is unchanged.
// The site doesn't name each PDF's original agency URL, so sourceUrl is the
// aggregator page; prefer an agency copy in lib/forms.ts where one exists.
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

import { createClient } from "@supabase/supabase-js"
import { extractText, getDocumentProxy } from "unpdf"

const SITE = "https://formsphilippines.com"
const OUT = new URL("../lib/forms-library.json", import.meta.url)
const BUCKET = "forms"
const UA = { "user-agent": "Mozilla/5.0 (HERMIT forms library; one request at a time)" }
const pause = () => new Promise((r) => setTimeout(r, 600))

// [agency id on the site, display name, include, exclude] — matched on the form's slug.
const AGENCIES = [
  [2, "BIR", /./, null],
  [14, "SSS", /./, null],
  [18, "Pag-IBIG Fund", /employer|esrs|household|kasambahay|member-s|mcrf|mdf|membership|mp2|specimen|transfer|calamity|refund|multi-purpose|stl-|penalty|loyalty/, null],
  [5, "PhilHealth", /member-registration|premium-payment|employer|report-of-employee|household|kasambahay|claim-signature|member-and-patient/, null],
  [19, "DTI", /bmbe|business-name|interview|economic-activity|resident-agent|inward-remittance|bank-certificate|resident-alien|sales-promotion|raffle|redemption|home-solicitation|repair-shop|warranty/, null],
  [22, "SEC", /cover-sheet|primary-regis|change-name|stock-and-transfer|membership-book|to-do-business|branch-office-in|representative-office|existing-(corporation|partnership)|non-stock-foreign|director-s-certificate|trustees|secretary-s-certificate|notification-update|fn-sworn|derogatory|user-designation|voluntary-revocation|treasurer-s-affidavit|^information-sheet|^application-form$|lending-company|personal-information-sheet/, /broker|investment|clearing|exchange|auditor|surety|credit-rating|commercial-paper|tender|mutal|underwriter|salesman/],
  [60, "CDA", /./, /governance|social-audit|mediation|economic-survey/],
  [35, "DOLE", /alien-employment|working-child/, null],
  [50, "DOLE (BWC)", /registration-re-registration|safety-and-health-organization|work-accident|annual-medical|drug-free|hiv|hepatitis|tuberculosis|compressed|economic-difficulties|no-pending-case|electrical-wiring|certificate-of-electrical/, null],
  [61, "DOLE (BLE)", /contractor|kasambahay|nsrp/, null],
  [27, "Bureau of Customs", /./, /personal-and-household|charitable/],
  [67, "FDA", /lto|food|petition|sales-promotion|promo|change-of|transfer|expansion|zonal|deletion|additional|sangkap|checklist|warehouse/, /clinical|vaccine|gmp|lot-release|adverse|course-registration/],
  [8, "IPOPHL", /trademark|actual-use|renewal|revival|transformation|replace/, null],
]

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY (pnpm forms:ph reads .env.local)")
const sb = createClient(url, key, { auth: { persistSession: false } })

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : []
const byId = new Map(previous.map((e) => [e.id, e]))
const out = []
const report = { added: 0, changed: 0, unchanged: 0, skipped: [] }
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim()

async function get(path) {
  const res = await fetch(new URL(path, SITE), { headers: UA, signal: AbortSignal.timeout(60_000) })
  await pause()
  return res
}

for (const [agencyId, agency, include, exclude] of AGENCIES) {
  const home = await (await get("/")).text()
  const agencyPath = home.match(new RegExp(`href="(/agency/${agencyId}/[^"]+)"`))?.[1]
  if (!agencyPath) {
    report.skipped.push(`${agency}: agency page not found`)
    continue
  }
  const listing = await (await get(agencyPath)).text()
  const forms = [...new Set(listing.match(/\/viewform\/\d+\/[^"]+/g) ?? [])]
    .map((p) => ({ path: p, id: p.split("/")[2], slug: p.split("/")[3] }))
    .filter((f) => include.test(f.slug) && !(exclude && exclude.test(f.slug)))
  console.log(`${agency}: ${forms.length} forms`)

  for (const f of forms) {
    try {
      const page = await (await get(f.path)).text()
      // Up to ".pdf": some file names contain an apostrophe (e.g. "Member's…").
      const file = page.match(/var url = '(?:\.\.\/)*(?:https:\/\/formsphilippines\.com\/)?(downloads\/.+?\.(?:pdf|docx?|xlsx?))';/i)?.[1]
      const title = decode(page.match(/<h1>([^<]+)<\/h1>/)?.[1] ?? f.slug.replace(/-/g, " "))
      if (!file || !/\.pdf$/i.test(file)) {
        report.skipped.push(`${agency} ${f.id} ${title}: no PDF`)
        continue
      }
      const res = await get(`/${encodeURI(decodeURI(file))}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (!res.ok || buf.subarray(0, 5).toString() !== "%PDF-" || buf.length > 25 * 1024 * 1024) {
        report.skipped.push(`${agency} ${f.id} ${title}: ${res.ok ? "not a PDF" : `HTTP ${res.status}`}`)
        continue
      }
      const sha256 = createHash("sha256").update(buf).digest("hex")
      const id = `ph-${f.id}`
      const path = `ph/${agency.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${f.id}-${f.slug.replace(/-+$/, "")}.pdf`
      const old = byId.get(id)
      if (old?.sha256 === sha256) {
        out.push({ ...old, agency, title })
        report.unchanged++
        continue
      }
      await sb.storage.from(BUCKET).upload(path, buf, { contentType: "application/pdf", upsert: true })
      let textPath = null
      let pages = null
      try {
        const doc = await getDocumentProxy(new Uint8Array(buf))
        pages = doc.numPages
        const { text } = await extractText(doc, { mergePages: true })
        if (text.trim().length > 40) {
          textPath = path.replace(/\.pdf$/, ".txt")
          await sb.storage.from(BUCKET).upload(textPath, Buffer.from(text.slice(0, 60_000)), { contentType: "text/plain; charset=utf-8", upsert: true })
        }
      } catch {}
      out.push({ id, agency, title, path, textPath, pages, sha256, sourceUrl: `${SITE}${f.path}`, retrievedAt: new Date().toISOString() })
      if (old) report.changed++
      else report.added++
    } catch (e) {
      report.skipped.push(`${agency} ${f.id}: ${e.message}`)
    }
  }
}

out.sort((a, b) => a.agency.localeCompare(b.agency) || a.title.localeCompare(b.title))
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n")
console.log(`\n${out.length} forms · ${report.added} new · ${report.changed} changed · ${report.unchanged} unchanged · ${report.skipped.length} skipped`)
for (const s of report.skipped) console.log(`  skipped: ${s}`)
