import { Suspense } from "react"

import { Roadmap } from "@/components/roadmap"
import { Skeleton } from "@/components/ui/skeleton"

export default function RoadmapPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Roadmap /></Suspense>
}
