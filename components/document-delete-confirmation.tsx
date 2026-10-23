"use client"

import { AlertDialog } from "@base-ui/react/alert-dialog"
import { LoaderCircle, TriangleAlert } from "lucide-react"
import { useRef, useState, useTransition, type ReactElement } from "react"

import { Button } from "@/components/ui/button"
import { DialogOverlay } from "@/components/ui/dialog"

export function DocumentDeleteConfirmation({
  trigger,
  title,
  description,
  actionLabel,
  pendingLabel = "Saving…",
  errorMessage = "Could not finish this action. Try again.",
  onConfirm,
}: {
  trigger: ReactElement
  title: string
  description: string
  actionLabel: string
  pendingLabel?: string
  errorMessage?: string
  onConfirm: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const busy = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  function confirm(): void {
    if (busy.current) return
    busy.current = true
    setError("")
    start(async () => {
      try {
        await onConfirm()
        setOpen(false)
      } catch {
        setError(errorMessage)
      } finally {
        busy.current = false
      }
    })
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy.current) {
          setOpen(next)
          setError("")
        }
      }}
    >
      <AlertDialog.Trigger render={trigger} />
      <AlertDialog.Portal>
        <DialogOverlay />
        <AlertDialog.Popup
          initialFocus={cancelRef}
          data-slot="dialog-content"
          data-dialog-size="confirm"
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[min(420px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl bg-popover p-6 text-sm text-popover-foreground shadow-xl outline-none"
        >
          <div
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
          >
            <TriangleAlert className="size-5" />
          </div>
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="text-lg font-semibold tracking-tight">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm leading-relaxed break-words text-muted-foreground">
              {description}
            </AlertDialog.Description>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Close
              render={
                <Button ref={cancelRef} variant="outline" disabled={pending} />
              }
            >
              Cancel
            </AlertDialog.Close>
            <Button
              variant="destructive"
              onClick={confirm}
              disabled={pending}
              aria-busy={pending}
            >
              {pending && (
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                />
              )}
              {pending ? pendingLabel : actionLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
