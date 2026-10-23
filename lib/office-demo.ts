import type { OfficeRecord } from "./office-registry"

// Synthetic fixture for explicitly enabled local development only.
const evidence = {
  sourceUrl: "https://example.org/",
  reviewer: "Local fixture",
  checkedOn: "2026-10-23",
  reviewDue: "2027-01-23",
}

export const DEMO_OFFICES: readonly OfficeRecord[] = [
  {
    id: "demo-permit-counter-a",
    name: "Permit counter A",
    type: "bplo", mode: "physical", status: "active",
    website: "https://example.org/",
    address: "Sample address A, City of Manila",
    physicalCityCode: "1380600000",
    services: [{ requirementId: "mayors_permit", serviceEvidence: evidence, coverageEvidence: evidence, areas: [{ cityCode: "1380600000" }] }],
    coordinates: { lat: 14.6, lng: 120.98, precision: "building", license: "Synthetic fixture", evidence },
  },
  {
    id: "demo-permit-counter-b",
    name: "Permit counter B",
    type: "bplo", mode: "physical", status: "active",
    website: "https://example.org/",
    address: "Sample address B, City of Manila",
    physicalCityCode: "1380600000",
    services: [{ requirementId: "mayors_permit", serviceEvidence: evidence, coverageEvidence: evidence, areas: [{ cityCode: "1380600000" }] }],
    coordinates: { lat: 14.61, lng: 120.99, precision: "building", license: "Synthetic fixture", evidence },
  },
]
