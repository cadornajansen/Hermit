import { getActivities } from "./activities.ts"
import { getRequirement } from "./engine.ts"
import type { Activity, Flag, Profile } from "./types"

export type DetailGroup = { title: string; flags: Flag[] }

export type DetailOptions = {
  groups: DetailGroup[]
  remainingGroups: DetailGroup[]
  packagedFood: boolean
  grouped: boolean
}

const DETAIL_GROUPS: DetailGroup[] = [
  { title: "Products", flags: ["food", "fda", "alcohol", "fuel"] },
  {
    title: "Services",
    flags: ["security", "lending", "transport", "construction", "professional"],
  },
  { title: "Trade", flags: ["import_export"] },
]

const ACTIVITY_DETAILS: Record<Activity, Flag[]> = {
  retail: ["food", "alcohol", "fda", "fuel"],
  food_service: ["alcohol"],
  manufacturing: ["import_export", "fda"],
  water_refilling: ["food"],
  professional_services: ["professional"],
  personal_services: ["fda"],
  repair: [],
  other: [],
}

function groupFlags(flags: ReadonlySet<Flag>): DetailGroup[] {
  return DETAIL_GROUPS.flatMap((group) => {
    const matching = group.flags.filter((flag) => flags.has(flag))
    return matching.length ? [{ title: group.title, flags: matching }] : []
  })
}

export function getDetailOptions(profile: Profile): DetailOptions {
  const activities = getActivities(profile)
  const grouped = activities === "unknown" || activities.includes("other")
  const allFlags = DETAIL_GROUPS.flatMap((group) => group.flags)
  const suggested = new Set(
    grouped
      ? allFlags
      : activities.flatMap((activity) => ACTIVITY_DETAILS[activity])
  )

  return {
    groups: grouped
      ? groupFlags(suggested)
      : suggested.size
        ? [{ title: "", flags: [...suggested] }]
        : [],
    remainingGroups: groupFlags(
      new Set(allFlags.filter((flag) => !suggested.has(flag)))
    ),
    packagedFood:
      activities !== "unknown" && activities.includes("manufacturing"),
    grouped,
  }
}

export function getDetailQuestionIds(profile: Profile): string[] {
  const options = getDetailOptions(profile)
  return [
    ...(options.packagedFood ? ["packagedFood"] : []),
    ...options.groups.flatMap((group) => group.flags),
  ]
}

export type DocumentOption = { id: string; name: string; agency: string }
export type DocumentGroup = { title: string; items: DocumentOption[] }
export type DocumentOptions = {
  matched: DocumentGroup[]
  possible: DocumentGroup[]
  previous: DocumentOption[]
}

const DOCUMENT_GROUPS: { title: string; ids: string[] }[] = [
  {
    title: "Registration",
    ids: ["dti_bn", "sec_reg", "cda_reg", "bir_cor", "bmbe"],
  },
  {
    title: "Local permits",
    ids: [
      "brgy_clearance",
      "mayors_permit",
      "fsic",
      "sanitary_permit",
      "cenro",
      "liquor_license",
    ],
  },
  { title: "Activity-specific", ids: ["health_certs", "fda_lto", "fda_cpr"] },
  {
    title: "Employer documents",
    ids: ["sss_er", "philhealth_er", "pagibig_er", "dole_1020"],
  },
]

function documentOption(id: string): DocumentOption {
  const requirement = getRequirement(id)
  return {
    id,
    name: requirement?.name ?? id,
    agency: requirement?.agency ?? "Saved selection",
  }
}

export function getDocumentOptions(profile: Profile): DocumentOptions {
  const matched: DocumentGroup[] = []
  const possible: DocumentGroup[] = []
  const visibleIds = new Set<string>()

  // An explicit list keeps filing actions and recurring duties out of a document chooser.
  for (const group of DOCUMENT_GROUPS) {
    const matchingItems: DocumentOption[] = []
    const possibleItems: DocumentOption[] = []
    for (const id of group.ids) {
      const applies = getRequirement(id)?.appliesWhen(profile)
      if (applies !== true && applies !== "maybe") continue
      visibleIds.add(id)
      const items = applies === true ? matchingItems : possibleItems
      items.push(documentOption(id))
    }
    if (matchingItems.length)
      matched.push({ title: group.title, items: matchingItems })
    if (possibleItems.length)
      possible.push({ title: group.title, items: possibleItems })
  }

  return {
    matched,
    possible,
    // Preserve older selections even when they are no longer offered to new profiles.
    previous: [...new Set(profile.have)]
      .filter((id) => !visibleIds.has(id))
      .map(documentOption),
  }
}

function visibleDocumentIds(profile: Profile): string[] {
  const options = getDocumentOptions(profile)
  return [...options.matched, ...options.possible].flatMap((group) =>
    group.items.map((item) => item.id)
  )
}

function hasNewId(
  before: readonly string[],
  after: readonly string[]
): boolean {
  const previousIds = new Set(before)
  return after.some((id) => !previousIds.has(id))
}

export function getReviewFollowUp(
  before: Profile,
  after: Profile,
  visited: readonly string[],
  reviewed: Partial<
    Record<"operations" | "details" | "documents", Profile>
  > = {}
): "operations" | "details" | "documents" | null {
  const showTaxChoice = (profile: Profile): boolean =>
    profile.structure === "sole" && profile.sales !== "over_3m"

  if (
    !visited.includes("operations") &&
    !showTaxChoice(reviewed.operations ?? before) &&
    showTaxChoice(after)
  ) {
    return "operations"
  }
  if (
    !visited.includes("details") &&
    hasNewId(
      getDetailQuestionIds(reviewed.details ?? before),
      getDetailQuestionIds(after)
    )
  ) {
    return "details"
  }
  if (
    !visited.includes("documents") &&
    hasNewId(
      visibleDocumentIds(reviewed.documents ?? before),
      visibleDocumentIds(after)
    )
  ) {
    return "documents"
  }
  return null
}
