import data from "./manila-barangays.json" with { type: "json" }
import { locationKey } from "./locations.ts"

// PSA PSGC identifies barangay jurisdictions, not barangay hall addresses.
export const MANILA_BARANGAYS: readonly { code: string; name: string; district: string }[] = data

export function findManilaBarangay(value: string) {
  const key = locationKey(value).replace(/^(?:brgy\.?|barangay)\s+/, "")
  if (!key) return undefined
  return MANILA_BARANGAYS.find((barangay) =>
    locationKey(barangay.name).replace(/^barangay\s+/, "") === key)
}
