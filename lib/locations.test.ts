import assert from "node:assert/strict"
import { test } from "node:test"

import {
  cities,
  citiesForRegion,
  matchesLocation,
  regions,
  resolveLocation,
  restoreLocation,
  selectCity,
  selectRegion,
} from "./locations.ts"
import { isPilotCity, officesFor } from "./offices.ts"

const NCR = "1300000000"
const CENTRAL_LUZON = "0300000000"
const taguig = cities.find((city) => city.name === "City of Taguig")!
const saved = {
  city: "Taguig",
  barangay: "Fort Bonifacio",
  businessName: "Nena's Store",
}

test("location snapshot has unique codes, valid region parents and NCR's 17 localities", () => {
  assert.equal(regions.length, 18)
  assert.ok(regions.some((region) => region.name.includes("Negros Island")))
  assert.equal(new Set(cities.map((city) => city.code)).size, cities.length)
  assert.ok(
    cities.every((city) =>
      regions.some((region) => region.code === city.regionCode)
    )
  )
  assert.equal(citiesForRegion(NCR).length, 17)
  assert.ok(citiesForRegion(NCR).some((city) => city.name === "Pateros"))
})

test("filtering ignores case, accents and outer whitespace, including province context", () => {
  assert.deepEqual(
    citiesForRegion(NCR).filter((city) => matchesLocation(city, "  TAGUIG ")),
    [taguig]
  )
  assert.ok(
    citiesForRegion(NCR).some((city) => matchesLocation(city, "paranaque"))
  )
  assert.ok(
    matchesLocation({ name: "San Jose", label: "San Jose · Tarlac" }, "tarlac")
  )
  assert.equal(
    regions.filter((region) => matchesLocation(region, "ncr")).length,
    1
  )
  assert.equal(
    cities.filter((city) => matchesLocation(city, "no-such-place-123")).length,
    0
  )
  assert.equal(
    regions.filter((region) => matchesLocation(region, "  ")).length,
    regions.length
  )
})

test("city choices depend on region and missing regions have no choices", () => {
  assert.ok(citiesForRegion(NCR).includes(taguig))
  assert.ok(!citiesForRegion(CENTRAL_LUZON).includes(taguig))
  assert.deepEqual(citiesForRegion(""), [])
})

test("legacy city-only profiles restore canonical names and infer their region", () => {
  for (const city of ["Taguig", "  TAGUIG CITY ", "City of Taguig"]) {
    const result = restoreLocation({ ...saved, city })
    assert.equal(result.city, "City of Taguig")
    assert.equal(result.region, "National Capital Region (NCR)")
    assert.equal(result.province, "")
    assert.equal(result.barangay, saved.barangay)
    assert.equal(result.businessName, saved.businessName)
    assert.equal(resolveLocation(result).issue, "")
    assert.deepEqual(
      restoreLocation(JSON.parse(JSON.stringify(result))),
      result
    )
  }
})

test("saved region aliases restore with missing city, without choosing a city automatically", () => {
  for (const region of ["NCR", "Metro Manila", "National Capital Region"]) {
    const restored = restoreLocation({ region, city: "" })
    assert.equal(restored.region, "National Capital Region (NCR)")
    assert.equal(restored.city, "")
  }
  assert.deepEqual(restoreLocation({ city: "" }), { city: "" })
  assert.equal(restoreLocation(JSON.parse("{}")).city, "")
  assert.equal(restoreLocation(JSON.parse('{"city":null}')).city, "")
})

test("unmatched and inconsistent saved values stay visible and are not silently reassigned", () => {
  for (const value of [
    { city: "Old town spelling" },
    { region: "Old region", city: "Taguig" },
    { region: "Region III (Central Luzon)", city: "Taguig" },
    { region: "NCR", province: "Tarlac", city: "Taguig" },
  ]) {
    const resolved = resolveLocation(value)
    assert.equal(resolved.city, null)
    assert.ok(resolved.issue.includes("Saved"))
    assert.equal(restoreLocation(value).city, value.city)
  }
})

test("ambiguous saved city names require a choice; province context restores the correct place", () => {
  const ambiguous = resolveLocation({ city: "San Jose" })
  assert.equal(ambiguous.city, null)
  assert.match(ambiguous.issue, /more than one place/)
  const restored = restoreLocation({ city: "San Jose", province: "Tarlac" })
  assert.equal(restored.region, "Region III (Central Luzon)")
  assert.equal(resolveLocation(restored).city?.province, "Tarlac")
})

test("changing and clearing a region resets incompatible city, province and barangay", () => {
  for (const code of [CENTRAL_LUZON, null]) {
    const next = selectRegion(restoreLocation(saved), code)
    assert.equal(next.city, "")
    assert.equal(next.province, "")
    assert.equal(next.barangay, "")
    assert.equal(next.businessName, saved.businessName)
  }
  assert.deepEqual(
    selectRegion(restoreLocation(saved), NCR),
    restoreLocation(saved)
  )
})

test("replacing an unmatched saved region clears its stale children", () => {
  const next = selectRegion(
    {
      region: "Old region",
      city: "Old town",
      province: "Old province",
      barangay: "Old barangay",
    },
    NCR
  )
  assert.equal(next.region, "National Capital Region (NCR)")
  assert.equal(next.city, "")
  assert.equal(next.province, "")
  assert.equal(next.barangay, "")
})

test("selecting a city saves canonical names, validates its region, and resets barangay only on change", () => {
  const current = restoreLocation(saved)
  assert.deepEqual(selectCity(current, taguig.code), current)
  const otherRegionCity = citiesForRegion(CENTRAL_LUZON)[0]
  assert.deepEqual(selectCity(current, otherRegionCity.code), current)
  const manila = citiesForRegion(NCR).find(
    (city) => city.name === "City of Manila"
  )!
  const next = selectCity(current, manila.code)
  assert.equal(next.city, manila.name)
  assert.equal(next.region, "National Capital Region (NCR)")
  assert.equal(next.barangay, "")
  assert.equal(selectCity(next, null).city, "")
})

test("same-named localities save the province needed for unambiguous restoration", () => {
  const city = cities.find(
    (item) => item.name === "San Jose" && item.province === "Tarlac"
  )!
  const next = selectCity(selectRegion({ city: "" }, CENTRAL_LUZON), city.code)
  assert.equal(next.city, "San Jose")
  assert.equal(next.province, "Tarlac")
  assert.equal(
    resolveLocation(JSON.parse(JSON.stringify(next))).city?.code,
    city.code
  )
})

test("canonical and legacy Taguig names keep the pilot office results", () => {
  for (const city of ["Taguig", "Taguig City", taguig.name]) {
    assert.ok(isPilotCity(city))
    assert.ok(officesFor(city, "", new Set(["bplo"])).length > 0)
  }
  assert.equal(isPilotCity("City of Manila"), false)
})
