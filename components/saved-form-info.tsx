"use client"

import { useState, type ReactElement } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  REUSABLE_FIELDS,
  type ReusableAnswer,
  type ReusableKey,
} from "@/lib/form-memory"
import { editSavedAnswer, useHermit, withdrawFormConsent } from "@/lib/store"

export function SavedFormInfo(): ReactElement {
  const { formMemory, ownerId } = useHermit()
  const [status, setStatus] = useState("")
  return (
    <Card id="saved-form-info" size="sm" aria-labelledby="saved-form-heading">
      <CardHeader>
        <CardTitle><h2 id="saved-form-heading">Saved form information</h2></CardTitle>
        <CardDescription>
          Answers you chose to reuse for this account, on this device. Account details
          can also pre-fill forms; use Edit profile to change them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {formMemory.consentedAt ? (
          <p className="text-xs text-muted-foreground">
            Last consent: {new Date(formMemory.consentedAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No consent or saved answers on this device.</p>
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
            size="sm"
            className="h-auto min-h-8 self-start whitespace-normal text-left"
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
        <p className="text-xs text-muted-foreground">Deleting saved answers does not change an open form or a downloaded file.</p>
        {status && <p role="status">{status}</p>}
      </CardContent>
    </Card>
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
}): ReactElement {
  const [value, setValue] = useState(answer.value)
  const [busy, setBusy] = useState(false)
  const label = REUSABLE_FIELDS[field][0]
  async function save(next: string): Promise<void> {
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
      className="flex flex-col gap-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save(value)
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`saved-answer-${field}`}>{label}</FieldLabel>
          <Input
            id={`saved-answer-${field}`}
            value={value}
            maxLength={500}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          />
          <FieldDescription>
            From {answer.sourceForm} · Updated{" "}
            {new Date(answer.updatedAt).toLocaleString()}
          </FieldDescription>
        </Field>
      </FieldGroup>
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
