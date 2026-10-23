import assert from "node:assert/strict"
import { test } from "node:test"
import { businessSearchAddress, directionsUrl, distanceKm } from "./nearby.ts"

test("great-circle calculation has known distances, identical points and stable antipodes", () => {
  assert.equal(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0)
  assert.ok(Math.abs(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.195) < 0.001)
  assert.ok(Math.abs(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }) - 20015.087) < 0.001)
})

test("directions share the verified destination without an origin or an API key", () => {
  const url = new URL(directionsUrl({ lat: 14.6, lng: 120.98 }))
  assert.equal(url.searchParams.get("destination"), "14.6,120.98")
  assert.equal(url.searchParams.get("api"), "1")
  assert.equal(url.searchParams.has("origin"), false)
  assert.equal(url.searchParams.has("key"), false)
})

test("explicit saved-address search retains region/province without duplicating locality", () => {
  const profile = { businessAddress: "12 Synthetic Road, Brgy. Example, San Jose, Tarlac", barangay: "Example", city: "San Jose", province: "Tarlac", region: "Central Luzon (Region III)" }
  assert.equal(businessSearchAddress(profile), `${profile.businessAddress}, ${profile.region}, Philippines`)
})
