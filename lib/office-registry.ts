import type { OfficeType } from "./types"

export type OfficeEvidence = {
  sourceUrl: string
  reviewer: string
  checkedOn: string
  reviewDue: string
}

export type OfficeRecord = {
  id: string
  name: string
  type: OfficeType
  mode: "physical" | "online" | "hybrid"
  status: "active" | "closed"
  website: string
  address?: string
  physicalCityCode?: string
  services: {
    requirementId: string
    serviceEvidence: OfficeEvidence
    coverageEvidence: OfficeEvidence
    areas: { cityCode: string; barangays?: string[] }[]
    assignmentRequired?: boolean
  }[]
  coordinates?: {
    lat: number
    lng: number
    precision: "entrance" | "building" | "approximate"
    license: string
    evidence: OfficeEvidence
  }
}

// Publish only independently reviewed records. Legacy Taguig seeds are not verified branches.
export const OFFICE_REGISTRY: readonly OfficeRecord[] = []
