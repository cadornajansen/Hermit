import type { ComplianceItem } from "./types"

export type DashboardSummary = {
  done: number
  total: number
  submitted: number
  blocked: number
  needsConfirmation: number
  nextAction: ComplianceItem | null
  awaitingSubmission: boolean
}

export function isCompleted(item: ComplianceItem): boolean {
  return item.status === "approved" || item.status === "expiring"
}

export function getBlockers(
  item: ComplianceItem,
  items: readonly ComplianceItem[]
): ComplianceItem[] {
  return items.filter(
    (prerequisite) =>
      item.prerequisites.includes(prerequisite.id) &&
      prerequisite.applies === true &&
      !isCompleted(prerequisite)
  )
}

export function getUncertainPrerequisites(
  item: ComplianceItem,
  items: readonly ComplianceItem[]
): ComplianceItem[] {
  return items.filter(
    (prerequisite) =>
      item.prerequisites.includes(prerequisite.id) &&
      prerequisite.applies === "maybe" &&
      !isCompleted(prerequisite)
  )
}

export function buildDashboardSummary(items: readonly ComplianceItem[]): DashboardSummary {
  const required = items.filter((item) => item.applies === true && !item.optional)
  const unfinished = required.filter((item) => !isCompleted(item) && item.status !== "submitted")
  // Excluded prerequisite IDs can represent alternative legal registration paths.
  const nextAction = unfinished.find(
    (item) => getBlockers(item, items).length === 0 && getUncertainPrerequisites(item, items).length === 0
  ) ?? null

  return {
    done: required.filter(isCompleted).length,
    total: required.length,
    submitted: required.filter((item) => item.status === "submitted").length,
    blocked: unfinished.filter((item) => getBlockers(item, items).length > 0).length,
    needsConfirmation: items.filter((item) => item.applies === "maybe").length,
    nextAction,
    awaitingSubmission: nextAction === null && items.some((item) => item.applies === true && item.status === "submitted"),
  }
}
