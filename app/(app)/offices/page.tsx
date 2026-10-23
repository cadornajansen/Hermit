import { OfficeFinder } from "@/components/office-finder"

export default async function OfficesPage({ searchParams }: {
  searchParams: Promise<{ requirement?: string | string[] }>
}) {
  const { requirement } = await searchParams
  const enabled = process.env.OFFICE_FINDER_ENABLED === "true"
  const demo = process.env.NODE_ENV === "development" && process.env.OFFICE_FINDER_DEMO === "true"
  return <OfficeFinder initialService={typeof requirement === "string" ? requirement : ""} enabled={enabled} canGeocode={enabled && Boolean(process.env.GOOGLE_MAPS_SERVER_KEY)} demo={demo} />
}
