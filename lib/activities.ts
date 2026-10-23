import type { Activity, Profile, Tri, Unknown } from "./types"

export const ACTIVITY_LABELS: Record<Activity, string> = {
  retail: "Retail",
  food_service: "Food service",
  water_refilling: "Water refilling",
  manufacturing: "Manufacturing",
  professional_services: "Professional services",
  personal_services: "Personal services",
  repair: "Repair",
  other: "Other",
}

export function getActivities(profile: Profile): Activity[] | Unknown {
  if (profile.activities !== undefined) return profile.activities
  if (profile.category === "unknown") return "unknown"
  return [profile.category === "packaged_food" ? "manufacturing" : profile.category]
}

export function normalizeProfile(profile: Profile): Profile {
  const activities = getActivities(profile)
  return {
    ...profile,
    activities: activities === "unknown" ? activities : [...new Set(activities)],
    ...(profile.activities === undefined && profile.category === "packaged_food" && profile.packagedFood === undefined
      ? { packagedFood: true }
      : {}),
  }
}

export function activityMatches(profile: Profile, ...activities: Activity[]): Tri {
  const selected = getActivities(profile)
  if (selected === "unknown" || selected.length === 0) return "maybe"
  return activities.some((activity) => selected.includes(activity))
}

export function packagedFoodMatches(profile: Profile): Tri {
  const manufacturing = activityMatches(profile, "manufacturing")
  if (manufacturing === false) return false
  // Preserve the old food-specific answer without treating all manufacturing as food.
  const detail = profile.packagedFood ?? (
    profile.activities === undefined && profile.category === "packaged_food" ? true : "unknown"
  )
  if (detail === false) return false
  return manufacturing === "maybe" || detail === "unknown" ? "maybe" : true
}

export function activitySummary(profile: Profile): string {
  const activities = getActivities(profile)
  if (activities === "unknown") return "Not sure yet"
  return activities.map((activity) => ACTIVITY_LABELS[activity]).join(", ") || "No activities selected"
}

// This describes missing activity-specific branches, not legal verification of the seeds.
export function coverageActivities(profile: Profile): Activity[] {
  const activities = getActivities(profile)
  if (activities === "unknown") return []
  return activities.filter((activity) => {
    if (activity === "retail" || activity === "food_service") return false
    return activity !== "manufacturing" || packagedFoodMatches(profile) !== true
  })
}
