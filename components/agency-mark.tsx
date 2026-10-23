import Image from "next/image"
import type { ReactElement } from "react"

import { cn } from "@/lib/utils"

const LOGOS = {
  DTI: { file: "dti", width: 137, height: 128 },
  BIR: { file: "bir", width: 1250, height: 226 },
  SEC: { file: "sec", width: 367, height: 238 },
  CDA: { file: "cda", width: 2246, height: 2246 },
} as const

function agencyAbbreviation(agency: string): string {
  if (agency.startsWith("City ")) return "LGU"
  if (agency === "Barangay hall") return "BRGY"
  if (agency === "Bureau of Customs") return "BOC"
  if (agency.startsWith("Pag-IBIG")) return "Pag-IBIG"
  return agency.split(/[ /]/)[0]
}

export function AgencyMark({ agency, decorative = false, className }: {
  agency: string
  decorative?: boolean
  className?: string
}): ReactElement {
  const abbreviation = agencyAbbreviation(agency)
  const logo = LOGOS[abbreviation as keyof typeof LOGOS]

  return (
    <span
      className={cn("flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-white p-1.5", className)}
      aria-hidden={decorative || undefined}
      role={!logo && !decorative ? "img" : undefined}
      aria-label={!logo && !decorative ? agency : undefined}
    >
      {logo ? (
        <Image src={`/brand/agencies/${logo.file}.png`} alt={decorative ? "" : agency} width={logo.width} height={logo.height} sizes="96px" className="h-full w-full object-contain" />
      ) : (
        <span className="text-center text-[10px] leading-tight font-bold text-slate-700">{abbreviation}</span>
      )}
    </span>
  )
}
