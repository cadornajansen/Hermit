"use client"

import Link from "next/link"
import { useState } from "react"

import { eligibleAnswers, REUSABLE_FIELDS } from "@/lib/form-memory"
import { saveFormAnswers, useHermit } from "@/lib/store"

export function useFormConsent(
  values: Record<string, string>,
  sourceForm: string
) {
  const { ownerId } = useHermit()
  const scope = `${ownerId}:${sourceForm}`
  const [consent, setConsent] = useState({ scope, optIn: false, status: "" })
  if (consent.scope !== scope) setConsent({ scope, optIn: false, status: "" })
  const optIn = consent.scope === scope && consent.optIn
  const status = consent.scope === scope ? consent.status : ""
  const eligible = Object.entries(eligibleAnswers(values))

  async function remember() {
    if (!optIn) return
    try {
      await saveFormAnswers(values, true, sourceForm)
      setConsent({ scope, optIn: false, status: "Eligible answers saved on this device. Review or delete them in Profile." })
    } catch {
      setConsent({ scope, optIn: false, status: "Your form can still be used, but answers could not be saved. Check your connection and browser storage, then try again." })
    }
  }

  const choice = (
    <section
      className="flex flex-col gap-2 rounded-xl border p-3 text-sm print:hidden"
      aria-label="Save answers for future forms"
    >
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setConsent({ scope, optIn: e.target.checked, status: "" })}
          disabled={!eligible.length}
          className="mt-1 size-4"
        />
        <span>
          Save eligible answers on this device for future forms when I copy,
          print, download, or continue to filing.
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Optional. Leave unchecked to continue without saving. Review and edit
        every answer before filing.
      </p>
      <details>
        <summary className="cursor-pointer text-primary">
          What would be saved ({eligible.length})
        </summary>
        <dl className="mt-2 space-y-1 text-xs break-words">
          {eligible.map(([key, value]) => (
            <div key={key}>
              <dt className="font-medium">
                {REUSABLE_FIELDS[key as keyof typeof REUSABLE_FIELDS][0]}
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="text-xs text-muted-foreground">
        Passwords, IDs and registration numbers, financial details, birth dates,
        signatures, and filing-specific or unknown fields are excluded to reduce
        sensitive storage and stale answers.
      </p>
      <Link href="/profile#saved-form-info" className="text-xs text-primary">
        Review saved information or withdraw consent
      </Link>
      {status && (
        <p role="status" className="text-xs">
          {status}
        </p>
      )}
    </section>
  )
  return { choice, remember }
}
