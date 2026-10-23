import data from "./forms-library.json"

// The wider library of business-related government forms (pnpm forms:ph):
// every PDF stored in HERMIT's public "forms" bucket, with extracted text.
export type LibraryForm = {
  id: string
  agency: string
  title: string
  path: string
  textPath: string | null
  pages: number | null
  sha256: string
  sourceUrl: string
  retrievedAt: string
}

export const FORMS_LIBRARY = data as LibraryForm[]

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/forms/`
export const libraryUrl = (path: string) => BASE + path.split("/").map(encodeURIComponent).join("/")

export const LIBRARY_AGENCIES = [...new Set(FORMS_LIBRARY.map((f) => f.agency))]

const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 1)

// Every query word must appear in the title or agency; titles that start with a word rank first.
export function searchLibrary(query: string, agency?: string, limit = 20) {
  const q = words(query)
  return FORMS_LIBRARY.filter((f) => !agency || f.agency === agency)
    .map((f) => {
      const hay = words(`${f.title} ${f.agency}`)
      const hits = q.filter((w) => hay.some((h) => h.startsWith(w)))
      return { f, score: q.length ? hits.length / q.length + (words(f.title)[0] === q[0] ? 0.5 : 0) : 1 }
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score || a.f.title.localeCompare(b.f.title))
    .slice(0, limit)
    .map((x) => x.f)
}

export const getLibraryForm = (id: string) => FORMS_LIBRARY.find((f) => f.id === id)
