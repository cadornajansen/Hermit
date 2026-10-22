import data from "./locations.json" with { type: "json" }

export type Region = { code: string; name: string }
export type City = {
  code: string
  name: string
  regionCode: string
  province: string
}
export type LocationValue = {
  region?: string
  province?: string
  city: string
  barangay?: string
}

export const regions: Region[] = data.regions
export const cities: City[] = data.cities

export const locationKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

// Older profiles and eGovPH often use "Taguig" or "Taguig City".
export const cityKey = (name: string) =>
  locationKey(name)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^city of /, "")
    .replace(/ city$/, "")
    .trim()

export function matchesLocation(
  item: { name: string; label?: string },
  query: string
) {
  return locationKey(item.label ?? item.name).includes(locationKey(query))
}

export const citiesForRegion = (code: string) =>
  cities.filter((city) => city.regionCode === code)

function findRegion(name: string) {
  const key = locationKey(name)
  if (!key) return null
  return (
    regions.find((region) => {
      const full = locationKey(region.name)
      return (
        full === key ||
        full.split(" (")[0] === key ||
        full.match(/\(([^)]+)\)/)?.[1] === key ||
        (key === "metro manila" && region.code === "1300000000")
      )
    }) ?? null
  )
}

export function resolveLocation(value: LocationValue) {
  const cityName = value.city ?? ""
  let region = findRegion(value.region ?? "")
  if (value.region && !region) {
    return {
      region: null,
      city: null,
      issue: `Saved region “${value.region}” is not in the location list. Choose a region to update it.`,
    }
  }
  let candidates = cities.filter(
    (city) =>
      (!region || city.regionCode === region.code) &&
      (!value.province ||
        locationKey(city.province) === locationKey(value.province)) &&
      cityKey(city.name) === cityKey(cityName)
  )
  // Prefer an exact name before considering spelling variants such as "City of …".
  const exact = candidates.filter(
    (city) => locationKey(city.name) === locationKey(cityName)
  )
  if (exact.length) candidates = exact
  const city = candidates.length === 1 ? candidates[0] : null
  if (city && !region) region = regions.find((r) => r.code === city.regionCode)!
  const issue = !value.city
    ? ""
    : city
      ? ""
      : candidates.length > 1
        ? `Saved city/municipality “${value.city}” matches more than one place. Choose its region and the entry with the correct province.`
        : `Saved city/municipality “${value.city}” is not in the available choices. It will be kept until you choose a replacement or clear it.`
  return { region, city, issue }
}

export function restoreLocation<T extends LocationValue>(
  value: T
): T & LocationValue {
  const { region, city } = resolveLocation(value)
  return {
    ...value,
    city: value.city ?? "",
    ...(region && { region: region.name }),
    ...(city && { city: city.name, province: city.province }),
  }
}

export function selectRegion<T extends LocationValue>(
  value: T,
  code: string | null
): T & LocationValue {
  const next = regions.find((region) => region.code === code)
  const current = resolveLocation(value)
  if (next && current.region?.code === next.code) return restoreLocation(value)
  return {
    ...value,
    region: next?.name ?? "",
    city: "",
    province: "",
    barangay: "",
  }
}

export function selectCity<T extends LocationValue>(
  value: T,
  code: string | null
): T & LocationValue {
  const { region, city: current } = resolveLocation(value)
  const city = cities.find(
    (item) => item.code === code && item.regionCode === region?.code
  )
  if (code && !city) return value
  return {
    ...value,
    region: region?.name ?? value.region,
    city: city?.name ?? "",
    province: city?.province ?? "",
    barangay: city && current?.code === city.code ? value.barangay : "",
  }
}
