import manifest from "./form-files.json"

// HERMIT's library of official blank forms and agency guides, copied into
// Supabase Storage (public bucket "forms") by scripts/sync-forms.mjs.
export type LibraryFile = (typeof manifest)[keyof typeof manifest][number] & { url: string; textUrl: string | null }

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/forms/`

export function libraryFiles(formId: string): LibraryFile[] {
  const entries = (manifest as Record<string, (typeof manifest)[keyof typeof manifest]>)[formId] ?? []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return []
  return entries.map((e) => ({ ...e, url: BASE + e.path, textUrl: e.textPath ? BASE + e.textPath : null }))
}

export const hasLibraryCopy = (formId: string) => formId in manifest
