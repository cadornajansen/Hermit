"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  REUSABLE_FIELDS,
  type ReusableAnswer,
  type ReusableKey,
} from "@/lib/form-memory"
import { editSavedAnswer, useHermit, withdrawFormConsent } from "@/lib/store"

export function SavedFormInfo() {
  const { formMemory, ownerId } = useHermit()
  const [status, setStatus] = useState("")
  return (
    <section id="saved-form-info" className="flex flex-col gap-3 text-sm">
      <h2 className="font-semibold">Saved form information</h2>
      <p className="text-xs text-muted-foreground">
        Only answers you chose to save for this account, on this device. Account
        details are separate and can still pre-fill forms; edit your profile to
        change them. Deletion does not change an open form or a downloaded file.
      </p>
      {formMemory.consentedAt ? (
        <p className="text-xs">
          Last consent: {new Date(formMemory.consentedAt).toLocaleString()}
        </p>
      ) : (
        <p>No consent or saved answers on this device.</p>
      )}
      {(
        Object.entries(formMemory.answers) as [ReusableKey, ReusableAnswer][]
      ).map(([key, answer]) => (
        <SavedAnswer
          key={`${ownerId}:${key}:${answer.updatedAt}:${answer.value}`}
          field={key}
          answer={answer}
          report={setStatus}
        />
      ))}
      {!!formMemory.consentedAt && (
        <Button
          variant="outline"
          className="self-start"
          onClick={async () => {
            try {
              await withdrawFormConsent()
              setStatus(
                "Consent withdrawn and all reusable answers deleted on this device."
              )
            } catch {
              setStatus(
                "Could not delete saved information. Check your connection and browser storage, then retry."
              )
            }
          }}
        >
          Withdraw consent and delete saved answers
        </Button>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  )
}

function SavedAnswer({
  field,
  answer,
  report,
}: {
  field: ReusableKey
  answer: ReusableAnswer
  report: (status: string) => void
}) {
  const [value, setValue] = useState(answer.value)
  const [busy, setBusy] = useState(false)
  const label = REUSABLE_FIELDS[field][0]
  async function save(next: string) {
    setBusy(true)
    try {
      await editSavedAnswer(field, next)
      report(next.trim() ? `${label} updated.` : `${label} deleted.`)
    } catch {
      report(
        "Could not save the change. Check your account, connection, and browser storage."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        void save(value)
      }}
    >
      <label className="flex flex-col gap-1">
        {label}
        <input
          className="h-10 rounded-lg border bg-background px-2"
          value={value}
          maxLength={500}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        From {answer.sourceForm} · Updated{" "}
        {new Date(answer.updatedAt).toLocaleString()}
      </p>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          Update
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void save("")}
        >
          Delete
        </Button>
      </div>
    </form>
  )
}
