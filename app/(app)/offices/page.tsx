import { OfficeFinder } from "@/components/office-finder"

export default async function OfficesPage({ searchParams }: {
  searchParams: Promise<{ requirement?: string | string[] }>
}) {
  const { requirement } = await searchParams
  const enabled = process.env.OFFICE_FINDER_ENABLED === "true"
  return <OfficeFinder initialService={typeof requirement === "string" ? requirement : ""} enabled={enabled} canGeocode={enabled && Boolean(process.env.GOOGLE_MAPS_SERVER_KEY)} />
}
