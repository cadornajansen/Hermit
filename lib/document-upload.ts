import { UPLOAD_HELP, UPLOAD_TYPES } from "./vault.ts"

export const DOCUMENT_ACCEPT = UPLOAD_TYPES.join(",")
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export function documentFileError(file: { size: number; type: string }): string | undefined {
  if (file.size === 0) return "This file is empty. Choose another file."
  if (file.size > MAX_DOCUMENT_BYTES) return "File exceeds 10 MB."
  if (!UPLOAD_TYPES.includes(file.type)) return UPLOAD_HELP
  return undefined
}
