"use client"

import { LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react"
import Image from "next/image"
import { unstable_rethrow } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { signIn, signUp } from "@/app/register/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type AccountMode = "signup" | "signin"

export function AccountForm({ authError }: { authError?: string }) {
  const [mode, setMode] = useState<AccountMode>("signup")
  const [error, setError] = useState(authError ?? "")
  const [message, setMessage] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, startTransition] = useTransition()
  const confirmationInput = useRef<HTMLInputElement>(null)
  const notice = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (error || message) notice.current?.focus()
  }, [error, message])

  function clearPasswords() {
    setPassword("")
    setConfirmation("")
  }

  function changeMode() {
    clearPasswords()
    setMode((previous) => (previous === "signup" ? "signin" : "signup"))
    setError("")
    setMessage("")
    setPasswordError("")
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    const data = new FormData(event.currentTarget)
    if (
      mode === "signup" &&
      data.get("password") !== data.get("confirmPassword")
    ) {
      setPasswordError("Passwords don’t match.")
      confirmationInput.current?.focus()
      confirmationInput.current?.scrollIntoView({ block: "nearest" })
      return
    }
    setPasswordError("")
    startTransition(async () => {
      try {
        const result = await (mode === "signup" ? signUp(data) : signIn(data))
        if (result.error) setError(result.error)
        if (result.message) {
          clearPasswords()
          setMessage(result.message)
        }
      } catch (caughtError) {
        unstable_rethrow(caughtError)
        setError(
          "We couldn’t reach sign-in. Check your connection and try again."
        )
      }
    })
  }

  return (
    <div className="flex max-h-full w-full max-w-[432px] flex-col gap-3">
      <a
        href="/api/auth/sso"
        aria-disabled={pending}
        tabIndex={pending ? -1 : undefined}
        onClick={(event) => {
          if (pending) event.preventDefault()
        }}
        className={cn(
          "inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-base tracking-tight text-ink shadow-sm transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
          pending && "pointer-events-none opacity-50"
        )}
      >
        Continue with
        <Image
          src="/brand/egov.png"
          alt="eGovPH"
          width={94}
          height={28}
          className="h-7 w-auto object-contain"
        />
      </a>
      <p className="shrink-0 text-center text-xs text-muted-foreground">OR</p>
      <form
        onSubmit={submit}
        aria-busy={pending}
        className="flex min-h-0 flex-col overflow-hidden rounded-[42px] border border-border/50 bg-card shadow-sm"
      >
        <div className="shrink-0 px-6 pt-6 pb-4 sm:px-[30px] sm:pt-[30px]">
          <h1 className="text-2xl font-normal tracking-[-0.045em]">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-4 sm:px-[30px]">
          {(error || message) && (
            <p
              ref={notice}
              tabIndex={-1}
              role={error ? "alert" : "status"}
              className={cn(
                "mb-4 rounded-xl p-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring",
                error
                  ? "bg-destructive/5 text-destructive"
                  : "bg-accent text-accent-foreground"
              )}
            >
              {error || message}
            </p>
          )}
          <FieldGroup className="gap-4 [&_[data-slot=field-label]]:text-xs [&_[data-slot=field-label]]:font-normal [&_[data-slot=field]]:gap-1.5 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:border-transparent [&_[data-slot=input]]:px-4">
            {mode === "signup" && (
              <Field>
                <FieldLabel
                  htmlFor="account-name"
                  className="items-center gap-1.5"
                >
                  <UserRound className="size-3.5" aria-hidden="true" />
                  Full name
                </FieldLabel>
                <Input
                  id="account-name"
                  name="fullName"
                  placeholder="Juan Dela Cruz"
                  autoComplete="name"
                  maxLength={100}
                  required
                  disabled={pending}
                />
              </Field>
            )}
            <Field>
              <FieldLabel
                htmlFor="account-email"
                className="items-center gap-1.5"
              >
                <Mail className="size-3.5" aria-hidden="true" />
                Email address
              </FieldLabel>
              <Input
                id="account-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={pending}
              />
            </Field>
            <div
              className={cn("grid gap-3", mode === "signup" && "grid-cols-2")}
            >
              <Field>
                <FieldLabel
                  htmlFor="account-password"
                  className="items-center gap-1.5"
                >
                  <LockKeyhole className="size-3.5" aria-hidden="true" />
                  Password
                </FieldLabel>
                <Input
                  id="account-password"
                  name="password"
                  type="password"
                  placeholder={
                    mode === "signup" ? "8+ characters" : "Your password"
                  }
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  required
                  disabled={pending}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setPasswordError("")
                  }}
                />
              </Field>
              {mode === "signup" && (
                <Field data-invalid={Boolean(passwordError)}>
                  <FieldLabel
                    htmlFor="account-confirm-password"
                    className="items-center gap-1.5"
                  >
                    <LockKeyhole
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Confirm password
                  </FieldLabel>
                  <Input
                    ref={confirmationInput}
                    id="account-confirm-password"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmation}
                    required
                    disabled={pending}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={
                      passwordError ? "password-match-error" : undefined
                    }
                    onChange={(event) => {
                      setConfirmation(event.target.value)
                      setPasswordError("")
                    }}
                  />
                </Field>
              )}
            </div>
            {passwordError && (
              <FieldError id="password-match-error">{passwordError}</FieldError>
            )}
          </FieldGroup>
        </div>
        <div className="shrink-0 px-6 pb-6 sm:px-[30px] sm:pb-[30px]">
          <Button type="submit" className="h-12 w-full" disabled={pending}>
            {pending && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {pending
              ? "Please wait…"
              : mode === "signup"
                ? "Sign up"
                : "Sign in"}
          </Button>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1 text-xs text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Hermit?"}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={changeMode}
              disabled={pending}
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </Button>
          </p>
        </div>
      </form>
    </div>
  )
}
