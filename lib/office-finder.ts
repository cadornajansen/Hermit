import { locationKey, resolveLocation, type LocationValue } from "./locations.ts"
import { distanceKm, type Point } from "./nearby.ts"
import { OFFICE_REGISTRY, type OfficeEvidence, type OfficeRecord } from "./office-registry.ts"

export type EligibleOffice = {
  office: OfficeRecord
  evidence: OfficeEvidence
  coverageEvidence: OfficeEvidence
  point?: Point
  km?: number
}

export const validPoint = (point: Point) =>
  Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180

export const officialUrl = (value: string) => {
  try { return new URL(value).protocol === "https:" } catch { return false }
}

export function currentEvidence(evidence: OfficeEvidence, today: string) {
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  return Boolean(evidence && officialUrl(evidence.sourceUrl) && evidence.reviewer.trim() &&
    date(evidence.checkedOn) && date(evidence.reviewDue) && evidence.checkedOn <= today && evidence.reviewDue >= today)
}

export function eligibleOffices(
  requirementId: string,
  area: LocationValue,
  assignedOfficeId = "",
  registry: readonly OfficeRecord[] = OFFICE_REGISTRY,
  today = new Date().toISOString().slice(0, 10)
) {
  const { city, issue } = resolveLocation(area)
  const offices: EligibleOffice[] = []
  const assignments: { id: string; name: string }[] = []
  let needsReview = 0
  let needsAssignment = 0
  if (!city) return { offices, assignments, needsReview, needsAssignment, issue: issue || "Confirm the business city or municipality." }
  const identities = new Map<string, number>()
  for (const office of registry) identities.set(office.id, (identities.get(office.id) ?? 0) + 1)
  for (const office of registry) {
    if (office.status !== "active") continue
    const service = office.services.find((entry) => entry.requirementId === requirementId)
    if (!service) continue
    const areaMatch = service.areas.some((entry) => entry.cityCode === city.code &&
      (!entry.barangays || entry.barangays.some((name) => locationKey(name) === locationKey(area.barangay ?? ""))))
    if (!areaMatch) continue
    if (!office.id || identities.get(office.id) !== 1 || !officialUrl(office.website) || !currentEvidence(service.serviceEvidence, today) || !currentEvidence(service.coverageEvidence, today)) {
      needsReview++
      continue
    }
    if (service.assignmentRequired) assignments.push({ id: office.id, name: office.name })
    if (service.assignmentRequired && office.id !== assignedOfficeId) {
      needsAssignment++
      continue
    }
    const coordinates = office.coordinates
    const point = office.mode !== "online" && office.address?.trim() && coordinates && validPoint(coordinates) &&
      coordinates.precision !== "approximate" && coordinates.license.trim() && currentEvidence(coordinates.evidence, today)
      ? { lat: coordinates.lat, lng: coordinates.lng } : undefined
    offices.push({ office, evidence: service.serviceEvidence, coverageEvidence: service.coverageEvidence, point })
  }
  offices.sort((a, b) => a.office.name.localeCompare(b.office.name) || a.office.id.localeCompare(b.office.id))
  return { offices, assignments, needsReview, needsAssignment, issue: "" }
}

export function rankOffices(offices: readonly EligibleOffice[], origin?: Point) {
  return offices.map((entry) => ({ ...entry, km: origin && validPoint(origin) && entry.point ? distanceKm(origin, entry.point) : undefined }))
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.office.id.localeCompare(b.office.id))
}

export const distanceLabel = (km: number) => `Approximate straight-line distance: about ${km.toFixed(1)} km`
