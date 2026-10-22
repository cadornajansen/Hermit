"use client"

import Link from "next/link"

import type { VaultDoc } from "@/lib/types"
import { cn } from "@/lib/utils"
import { coverage, docName } from "@/lib/vault"

const TONE = {
  verified: "text-primary",
  needs_review: "text-amber-700 dark:text-amber-400",
  rejected: "text-destructive",
  missing: "text-muted-foreground",
}
const MARK = { verified: "✓", needs_review: "!", rejected: "✗", missing: "○" }

// Per-requirement document tracker shown on the checklist.
export function DocSlots({ requirementId, docs }: { requirementId: string; docs: VaultDoc[] }) {
  const c = coverage(requirementId, docs)
  if (!c) return null
  const slots = [...c.needs, ...(c.issued ? [c.issued] : [])]
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Sa vault mo · In your vault</p>
      <ul className="flex flex-col gap-1">
        {slots.map((slot, i) => {
          const state = slot.doc?.verdict ?? "missing"
          const issued = slot === c.issued
          return (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className={cn("text-sm", TONE[state])}>
                {MARK[state]} {slot.types.map(docName).join(" / ")}
                {issued && <span className="text-xs text-muted-foreground"> (ibibigay sa iyo)</span>}
              </span>
              {state !== "verified" && (
                <Link
                  href={`/vault?req=${requirementId}${slot.types.length === 1 ? `&type=${slot.types[0]}` : ""}`}
                  className="shrink-0 text-xs text-primary"
                >
                  {state === "missing" ? "I-upload" : "Ayusin"}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
