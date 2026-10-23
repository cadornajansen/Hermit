"use client"

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Droplets,
  Factory,
  Info,
  Scissors,
  UserRound,
  Mail,
  MapPin,
  Building2,
  Users,
  Wallet,
  ChartNoAxesCombined,
  FileText,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
  BirthDateField,
  ChoiceField,
  SelectField,
  TextField,
} from "@/components/onboarding-controls"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  ACTIVITY_LABELS,
  activitySummary,
  getActivities,
  normalizeProfile,
} from "@/lib/activities"
import { diffChecklists, EMPTY_PROFILE } from "@/lib/engine"
import {
  getDetailOptions,
  getDocumentOptions,
  getReviewFollowUp,
  type DocumentGroup,
  type DocumentOption,
} from "@/lib/onboarding-options"
import { currentStorageKey, update, useHermit } from "@/lib/store"
import type { Activity, Flag, Profile } from "@/lib/types"
import { cn } from "@/lib/utils"

export type IdentityPrefill = Pick<
  Profile,
  | "ownerName"
  | "birthDate"
  | "homeAddress"
  | "mobile"
  | "email"
  | "barangay"
  | "city"
  | "identityVerified"
>

export const LABELS = {
  category: {
    retail: "Retail",
    food_service: "Food service",
    packaged_food: "Packaged-food manufacturing",
    other: "Other",
  },
  stage: {
    planning: "Planning to open",
    operating_unregistered: "Operating, not yet registered",
    registered: "Already registered",
  },
  structure: {
    sole: "Sole proprietorship",
    partnership: "Partnership",
    corporation: "Corporation / OPC",
    cooperative: "Cooperative",
  },
  premises: {
    home: "Home-based",
    rented: "Rented premises",
    owned: "Owned premises",
  },
  channel: {
    physical: "Physical location",
    online: "Online only",
    both: "Online and in person",
    mobile: "Mobile / delivery",
  },
  assets: {
    under_3m: "Under ₱3 million",
    "3m_15m": "₱3–15 million",
    "15m_100m": "₱15–100 million",
  },
  sales: {
    under_500k: "Under ₱500,000",
    "500k_3m": "₱500,000–3 million",
    over_3m: "Over ₱3 million",
  },
  taxOption: { "8pct": "8% option", graduated: "Graduated rates" },
  employees: {
    none: "Just me",
    "1_9": "1–9 employees",
    "10_99": "10–99 employees",
    "100_plus": "100+ employees",
  },
} as const

export const FLAG_LABELS: Record<Flag, string> = {
  food: "Sell food or drinks",
  fda: "Drugs, cosmetics or medical products",
  alcohol: "Alcohol or tobacco",
  fuel: "Fuel or LPG",
  security: "Firearms or security services",
  lending: "Lending, remittance or pawnshop",
  import_export: "Import or export",
  transport: "Transport or delivery services",
  construction: "Construction",
  professional: "PRC-licensed professional work",
}
const ACTIVITY_ICONS = {
  retail: Store,
  food_service: UtensilsCrossed,
  water_refilling: Droplets,
  manufacturing: Factory,
  professional_services: BriefcaseBusiness,
  personal_services: Scissors,
  repair: Wrench,
  other: Store,
}
const STEPS = [
  "business",
  "setup",
  "location",
  "operations",
  "details",
  "documents",
  "review",
] as const
type Step = (typeof STEPS)[number]
type DocumentsChoice = "" | "none" | "some"
type ReviewEdit = {
  before: Profile
  reviewed: Partial<Record<Step, Profile>>
}
const TITLES: Record<Step, string> = {
  business: "Add your business",
  setup: "Registration",
  location: "Business location",
  operations: "Business operations",
  details: "Activity details",
  documents: "Your documents",
  review: "Review your business",
}

export function Onboarding({
  identity,
  authError,
}: {
  identity: IdentityPrefill | null
  authError?: string
}) {
  const { ready, synced, ownerId, scopeError, profile } = useHermit()
  if (scopeError) return <p role="alert" className="py-24 text-center text-sm text-destructive">{scopeError}</p>
  if (!ready || !synced || !ownerId)
    return (
      <p
        className="py-24 text-center text-sm text-muted-foreground"
        role="status"
      >
        Loading your saved details…
      </p>
    )
  return <Wizard saved={profile} identity={identity} authError={authError} />
}

function Wizard({
  saved,
  identity,
  authError,
}: {
  saved: Profile | null
  identity: IdentityPrefill | null
  authError?: string
}) {
  const router = useRouter()
  const [p, setP] = useState<Profile>(() => {
    const base = saved
      ? normalizeProfile(saved)
      : {
          ...EMPTY_PROFILE,
          city: "Manila",
          lang: "en" as const,
          reminders: [],
          activities: [],
          flags: Object.fromEntries(
            Object.keys(FLAG_LABELS).map((key) => [key, "unknown"])
          ) as Profile["flags"],
        }
    return identity
      ? {
          ...base,
          ...identity,
          ownerName: base.ownerName || identity.ownerName,
          email: base.email || identity.email,
          birthDate: base.birthDate || identity.birthDate,
          homeAddress: base.homeAddress || identity.homeAddress,
          mobile: base.mobile || identity.mobile,
          barangay: base.barangay || identity.barangay,
          city: (saved && base.city) || "Manila",
        }
      : base
  })
  const [step, setStep] = useState<Step>(saved ? "review" : "business")
  const [error, setError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [reviewEdit, setReviewEdit] = useState<ReviewEdit | null>(null)
  const [documentsChoice, setDocumentsChoice] = useState<DocumentsChoice>(
    saved?.have.length ? "some" : ""
  )
  const heading = useRef<HTMLHeadingElement>(null)
  const questions = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    questions.current?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [step])
  const set = (patch: Partial<Profile>) =>
    setP((previous) => ({ ...previous, ...patch }))
  const index = STEPS.indexOf(step)
  const activities = getActivities(p)
  const detailOptions = getDetailOptions(p)
  const compactCard =
    (step === "details" &&
      detailOptions.groups.length === 0 &&
      !detailOptions.packagedFood) ||
    (step === "documents" && documentsChoice !== "some")
  const editingSection = reviewEdit !== null && step !== "review"
  const hasFollowUp =
    reviewEdit !== null &&
    getReviewFollowUp(reviewEdit.before, p, [step], reviewEdit.reviewed) !== null
  const goTo = (next: Step) => {
    setError("")
    setSaveError("")
    setStep(next)
  }
  const editSection = (next: Step) => {
    setReviewEdit((current) => current ?? { before: p, reviewed: {} })
    goTo(next)
  }

  function continueForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      (step === "location" || step === "review") &&
      p.city.trim().toLowerCase() !== "manila"
    ) {
      if (step === "review") goTo("location")
      setError("Business intake is currently limited to the City of Manila.")
      return
    }
    if (
      (step === "business" || step === "review") &&
      (activities === "unknown" || activities.length === 0)
    ) {
      if (step === "review") goTo("business")
      setError(
        "Choose at least one activity. Select Other if yours isn’t listed."
      )
      document.getElementById("activity-error")?.focus()
      return
    }
    if (reviewEdit) {
      const reviewed = { ...reviewEdit.reviewed, [step]: p }
      const followUp = getReviewFollowUp(reviewEdit.before, p, [step], reviewed)
      setReviewEdit(followUp ? { ...reviewEdit, reviewed } : null)
      if (followUp || step !== "review") {
        goTo(followUp ?? "review")
        return
      }
    }
    if (step !== "review") {
      goTo(STEPS[index + 1])
      return
    }
    const profile = normalizeProfile({
      ...p,
      ownerName: p.ownerName.trim(),
      businessName: p.businessName.trim(),
    })
    update(() => ({
      profile,
      lastDiff: saved ? diffChecklists(saved, profile) : null,
    }))
    try {
      const persisted = JSON.parse(
        localStorage.getItem(currentStorageKey()) ?? "null"
      ) as { profile?: Profile } | null
      if (JSON.stringify(persisted?.profile) !== JSON.stringify(profile)) {
        setSaveError(
          "Your browser could not save these details. Free some storage or allow site storage, then try again. Your answers remain here."
        )
        return
      }
    } catch {
      setSaveError(
        "Your browser blocked saving. Allow site storage and try again. Your answers remain here."
      )
      return
    }
    router.push("/dashboard")
  }

  const screens: Record<Step, React.ReactNode> = {
    business: (
      <BusinessStep p={p} set={set} error={error} setError={setError} />
    ),
    setup: <SetupStep p={p} set={set} />,
    location: <LocationStep p={p} set={set} error={error} setError={setError} />,
    operations: <OperationsStep p={p} set={set} />,
    details: <DetailsStep p={p} set={set} />,
    documents: (
      <DocumentsStep
        p={p}
        set={set}
        choice={documentsChoice}
        onChoiceChange={setDocumentsChoice}
      />
    ),
    review: <ReviewStep p={p} set={set} goTo={editSection} />,
  }

  return (
    <div className="flex h-full max-h-[800px] w-full max-w-lg flex-col gap-4 [@media(max-height:600px)]:gap-2">
      <nav aria-label="Business setup progress" className="shrink-0 px-2">
        <div className="mb-2 flex h-9 items-center justify-between text-sm text-muted-foreground [@media(max-height:600px)]:mb-1 [@media(max-height:600px)]:h-8">
          {index > 0 || editingSection ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goTo(editingSection ? "review" : STEPS[index - 1])}
              className="-ml-2 h-9 px-2"
            >
              <ArrowLeft data-icon="inline-start" />
              {editingSection ? "Back to review" : "Back"}
            </Button>
          ) : (
            <span>Business setup</span>
          )}
          <span aria-live="polite">
            Step {index + 1} of {STEPS.length}
          </span>
        </div>
        <Progress
          value={((index + 1) / STEPS.length) * 100}
          aria-label="Setup progress"
          className="[&_[data-slot=progress-track]]:h-1"
        />
      </nav>
      <div
        className={cn(
          "flex min-h-0 flex-col overflow-hidden rounded-[32px] border border-border/50 bg-card shadow-lg shadow-foreground/5 sm:rounded-[40px]",
          compactCard ? "flex-initial" : "flex-1"
        )}
      >
        <div className="shrink-0 px-5 pt-6 pb-6 sm:px-8 sm:pt-8 [@media(max-height:600px)]:pt-4 [@media(max-height:600px)]:pb-3">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-2xl font-medium tracking-[-0.045em] outline-none [@media(max-height:600px)]:text-xl"
          >
            {TITLES[step]}
          </h1>
        </div>
        <form onSubmit={continueForm} className="flex min-h-0 flex-1 flex-col">
          <div
            ref={questions}
            className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto overscroll-contain px-5 pb-6 sm:px-8 [&_[data-slot=field-group]]:gap-6 [&_[data-slot=field-legend]]:mb-2 [&_[data-slot=field-set]]:gap-3 [&_[data-slot=field]]:gap-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
          >
            {authError && (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
            {screens[step]}
            {saveError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {saveError}
              </p>
            )}
          </div>
          <div className="shrink-0 border-t border-border/60 px-5 pt-4 pb-5 sm:px-8 sm:pb-6 [@media(max-height:600px)]:py-3">
            <Button type="submit" size="lg" className="w-full">
              {step === "review"
                ? "Build my roadmap"
                : editingSection && !hasFollowUp
                  ? "Review changes"
                  : "Continue"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

type ProfileStepProps = { p: Profile; set: (patch: Partial<Profile>) => void }

function OwnerDetails({ p, set }: ProfileStepProps) {
  return (
    <FieldGroup>
      <TextField
        icon={UserRound}
        label="Full name"
        value={p.ownerName}
        onChange={(event) => set({ ownerName: event.target.value })}
        autoComplete="name"
      />
      <TextField
        icon={Mail}
        label="Email address"
        type="email"
        value={p.email}
        onChange={(event) => set({ email: event.target.value })}
        autoComplete="email"
      />
      <BirthDateField
        value={p.birthDate}
        onChange={(birthDate) => set({ birthDate })}
      />
      <TextField
        icon={MapPin}
        label="Home address"
        value={p.homeAddress}
        onChange={(event) => set({ homeAddress: event.target.value })}
        autoComplete="street-address"
      />
      <TextField
        label="Mobile number"
        type="tel"
        value={p.mobile}
        onChange={(event) => set({ mobile: event.target.value })}
        autoComplete="tel"
      />
    </FieldGroup>
  )
}

function BusinessStep({
  p,
  set,
  error,
  setError,
}: ProfileStepProps & { error: string; setError: (error: string) => void }) {
  const activities = getActivities(p)
  const selected = activities === "unknown" ? [] : activities
  function chooseActivity(activity: Activity, checked: boolean) {
    set({
      activities: checked
        ? [...new Set([...selected, activity])]
        : selected.filter((item) => item !== activity),
    })
    setError("")
  }
  return (
    <FieldGroup>
      <TextField
        icon={Store}
        label="Business name (optional)"
        placeholder="e.g. Ana’s Store"
        value={p.businessName}
        onChange={(event) => set({ businessName: event.target.value })}
        maxLength={200}
      />
      <FieldSet
        aria-describedby="activity-hint activity-error"
        data-invalid={Boolean(error)}
      >
        <FieldLegend variant="label">Activities</FieldLegend>
        <FieldDescription id="activity-hint">
          Select all that apply.
        </FieldDescription>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {(Object.entries(ACTIVITY_LABELS) as [Activity, string][]).map(
            ([activity, title]) => {
              const Icon = ACTIVITY_ICONS[activity]
              return (
                <FieldLabel
                  key={activity}
                  htmlFor={`activity-${activity}`}
                  className={cn(
                    "min-h-16 w-full cursor-pointer items-center gap-1.5 rounded-2xl border px-2.5 py-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30 sm:gap-2 sm:px-3",
                    selected.includes(activity)
                      ? "border-primary bg-accent"
                      : "hover:bg-muted"
                  )}
                >
                  <Icon
                    className="size-4 shrink-0 text-primary sm:size-5"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium wrap-break-word sm:text-sm">
                      {title}
                    </span>
                  </span>
                  <Checkbox
                    className="size-3.5 sm:size-4"
                    id={`activity-${activity}`}
                    checked={selected.includes(activity)}
                    onCheckedChange={(checked) =>
                      chooseActivity(activity, checked)
                    }
                    aria-invalid={Boolean(error)}
                  />
                </FieldLabel>
              )
            }
          )}
        </div>
        <p
          id="activity-error"
          tabIndex={-1}
          role={error ? "alert" : undefined}
          className="text-sm text-destructive"
        >
          {error}
        </p>
      </FieldSet>
      {selected.includes("other") && (
        <Field>
          <FieldLabel htmlFor="business-description">
            What does your business do? (optional)
          </FieldLabel>
          <Textarea
            id="business-description"
            placeholder="Describe the goods or services you offer."
            value={p.description}
            onChange={(event) => set({ description: event.target.value })}
          />
        </Field>
      )}
    </FieldGroup>
  )
}

function SetupStep({ p, set }: ProfileStepProps) {
  return (
    <FieldGroup>
      <ChoiceField
        icon={FileText}
        label="Registration status"
        value={p.stage}
        options={LABELS.stage}
        onChange={(value) => set({ stage: value as Profile["stage"] })}
      />
      <SelectField
        icon={Building2}
        label="Legal form"
        value={p.structure}
        options={LABELS.structure}
        onChange={(value) => set({ structure: value as Profile["structure"] })}
      />
    </FieldGroup>
  )
}

function LocationStep({
  p,
  set,
  error,
  setError,
}: ProfileStepProps & { error: string; setError: (error: string) => void }) {
  return (
    <FieldGroup>
      <TextField
        icon={MapPin}
        label="Business address"
        value={p.businessAddress}
        onChange={(event) => set({ businessAddress: event.target.value })}
        placeholder="Street, building or unit"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          icon={MapPin}
          label="Barangay"
          value={p.barangay}
          onChange={(event) => set({ barangay: event.target.value })}
          placeholder="e.g. Barangay 100"
        />
        <TextField
          icon={Building2}
          label="City / municipality"
          value={p.city}
          onChange={(event) => {
            set({ city: event.target.value })
            setError("")
          }}
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <ChoiceField
        icon={Building2}
        label="Premises"
        value={p.premises}
        options={LABELS.premises}
        onChange={(value) => set({ premises: value as Profile["premises"] })}
      />
      {p.city.trim().toLowerCase() !== "manila" && (
        <FieldDescription>
          Local guidance is limited to the City of Manila.
        </FieldDescription>
      )}
    </FieldGroup>
  )
}

function OperationsStep({ p, set }: ProfileStepProps) {
  return (
    <FieldGroup>
      <SelectField
        icon={Store}
        label="Sales channel"
        value={p.channel}
        options={LABELS.channel}
        onChange={(value) => set({ channel: value as Profile["channel"] })}
      />
      <SelectField
        icon={Users}
        label="Employees"
        value={p.employees}
        options={LABELS.employees}
        onChange={(value) => set({ employees: value as Profile["employees"] })}
      />
      <details className="rounded-2xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Business size & tax details
        </summary>
        <FieldGroup className="mt-5">
          <SelectField
            icon={Wallet}
            label="Estimated assets, excluding land"
            value={p.assets}
            options={LABELS.assets}
            onChange={(value) => set({ assets: value as Profile["assets"] })}
          />
          <SelectField
            icon={ChartNoAxesCombined}
            label="Estimated annual sales"
            value={p.sales}
            options={LABELS.sales}
            onChange={(value) => set({ sales: value as Profile["sales"] })}
          />
          {p.structure === "sole" && p.sales !== "over_3m" && (
            <SelectField
              icon={FileText}
              label="Existing income tax choice"
              value={p.taxOption}
              options={LABELS.taxOption}
              onChange={(value) =>
                set({ taxOption: value as Profile["taxOption"] })
              }
            />
          )}
        </FieldGroup>
      </details>
    </FieldGroup>
  )
}

function DetailsStep({ p, set }: ProfileStepProps) {
  const options = getDetailOptions(p)
  return (
    <FieldGroup>
      {options.packagedFood && (
        <ChoiceField
          icon={Factory}
          label="Do you make or repack food products?"
          value={String(p.packagedFood ?? "unknown")}
          options={{ true: "Yes", false: "No" }}
          unknownLabel="Not sure"
          layout="inline"
          onChange={(value) =>
            set({
              packagedFood: value === "unknown" ? "unknown" : value === "true",
            })
          }
        />
      )}
      {options.groups.map((group, index) =>
        options.grouped ? (
          <details
            key={group.title}
            className="rounded-2xl border p-4"
            open={index === 0}
          >
            <summary className="cursor-pointer text-sm font-medium">
              {group.title}
            </summary>
            <div className="pt-5">
              <ActivityQuestions p={p} set={set} flags={group.flags} />
            </div>
          </details>
        ) : (
          <ActivityQuestions
            key="relevant-questions"
            p={p}
            set={set}
            flags={group.flags}
          />
        )
      )}
      {options.groups.length === 0 && !options.packagedFood && (
        <FieldDescription>
          No follow-up questions. Continue, or check other activities below.
        </FieldDescription>
      )}
      {options.remainingGroups.length > 0 && (
        <details className="rounded-2xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Other regulated activities
          </summary>
          <FieldGroup className="mt-5">
            {options.remainingGroups.map((group) => (
              <FieldSet key={group.title}>
                <FieldLegend variant="label" className="text-muted-foreground">
                  {group.title}
                </FieldLegend>
                <ActivityQuestions p={p} set={set} flags={group.flags} />
              </FieldSet>
            ))}
          </FieldGroup>
        </details>
      )}
    </FieldGroup>
  )
}

function ActivityQuestions({
  p,
  set,
  flags,
}: ProfileStepProps & { flags: Flag[] }) {
  return (
    <FieldGroup>
      {flags.map((flag) => (
        <ChoiceField
          key={flag}
          label={FLAG_LABELS[flag]}
          value={String(p.flags[flag] ?? "unknown")}
          options={{ true: "Yes", false: "No" }}
          unknownLabel="Not sure"
          layout="inline"
          onChange={(value) =>
            set({
              flags: {
                ...p.flags,
                [flag]: value === "unknown" ? "unknown" : value === "true",
              },
            })
          }
        />
      ))}
    </FieldGroup>
  )
}

function DocumentsStep({
  p,
  set,
  choice,
  onChoiceChange,
}: ProfileStepProps & {
  choice: DocumentsChoice
  onChoiceChange: (choice: DocumentsChoice) => void
}) {
  const options = getDocumentOptions(p)
  return (
    <FieldGroup>
      <ChoiceField
        icon={FileText}
        label="Already have registrations or permits? (optional)"
        value={choice}
        options={{ none: "None yet", some: "I have some" }}
        unknown={false}
        onChange={(value) => {
          onChoiceChange(value as DocumentsChoice)
          if (value === "none") set({ have: [] })
        }}
      />
      {choice === "some" && (
        <>
          <FieldDescription>
            Select the documents you already have.
          </FieldDescription>
          <DocumentGroups p={p} set={set} groups={options.matched} />
          {options.possible.length > 0 && (
            <details className="rounded-2xl border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                May apply—confirm first
              </summary>
              <div className="pt-5">
                <DocumentGroups p={p} set={set} groups={options.possible} />
              </div>
            </details>
          )}
          {options.previous.length > 0 && (
            <FieldSet>
              <FieldLegend variant="label">Previously selected</FieldLegend>
              <FieldDescription>
                These no longer match your current answers.
              </FieldDescription>
              <DocumentRows p={p} set={set} items={options.previous} />
            </FieldSet>
          )}
        </>
      )}
    </FieldGroup>
  )
}

function DocumentGroups({
  p,
  set,
  groups,
}: ProfileStepProps & { groups: DocumentGroup[] }) {
  return (
    <FieldGroup>
      {groups.map((group) => (
        <FieldSet key={group.title}>
          <FieldLegend variant="label" className="text-muted-foreground">
            {group.title}
          </FieldLegend>
          <DocumentRows p={p} set={set} items={group.items} />
        </FieldSet>
      ))}
    </FieldGroup>
  )
}

function DocumentRows({
  p,
  set,
  items,
}: ProfileStepProps & { items: DocumentOption[] }) {
  return (
    <div className="divide-y overflow-hidden rounded-2xl border">
      {items.map((item) => (
        <FieldLabel
          key={item.id}
          htmlFor={`have-${item.id}`}
          className={cn(
            "min-h-16 w-full cursor-pointer items-start gap-3 px-4 py-3 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset has-data-checked:bg-accent",
            p.have.includes(item.id) ? "bg-accent" : "hover:bg-muted"
          )}
        >
          <Checkbox
            id={`have-${item.id}`}
            className="mt-0.5"
            checked={p.have.includes(item.id)}
            onCheckedChange={(checked) =>
              set({
                have: checked
                  ? [...new Set([...p.have, item.id])]
                  : p.have.filter((id) => id !== item.id),
              })
            }
          />
          <span className="min-w-0 leading-snug">
            {item.name}
            <span className="mt-1 block text-xs text-muted-foreground">
              {item.agency}
            </span>
          </span>
        </FieldLabel>
      ))}
    </div>
  )
}

function ReviewStep({
  p,
  set,
  goTo,
}: ProfileStepProps & { goTo: (step: Step) => void }) {
  return (
    <FieldGroup>
      <div className="rounded-2xl bg-accent p-5">
        <p className="font-medium">{p.businessName || "Your business"}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {activitySummary(p)}
        </p>
      </div>
      <dl className="divide-y">
        {(
          [
            ["business", "Business activities", activitySummary(p)],
            [
              "setup",
              "Registration & legal form",
              `${label("stage", p.stage)} · ${label("structure", p.structure)}`,
            ],
            [
              "location",
              "Location",
              [p.businessAddress, p.barangay, p.city]
                .filter(Boolean)
                .join(", ") || "Not decided",
            ],
            [
              "operations",
              "Operations",
              `${label("channel", p.channel)} · ${label("employees", p.employees)}`,
            ],
            [
              "details",
              "Activity details",
              `${Object.values(p.flags).filter((value) => value === true).length} selected, ${Object.values(p.flags).filter((value) => value === "unknown").length} uncertain`,
            ],
            ["documents", "Documents held", `${p.have.length} self-reported`],
          ] as [Step, string, string][]
        ).map(([target, title, value]) => (
          <div
            key={target}
            className="flex items-start justify-between gap-3 py-4"
          >
            <div>
              <dt className="text-xs text-muted-foreground">{title}</dt>
              <dd className="mt-1 text-sm leading-relaxed">{value}</dd>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goTo(target)}
              aria-label={`Edit ${title.toLowerCase()}`}
            >
              Edit
            </Button>
          </div>
        ))}
      </dl>
      <details className="rounded-xl border p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <UserRound className="size-4" aria-hidden="true" />
          Owner details (optional)
        </summary>
        <FieldGroup className="mt-4">
          <OwnerDetails p={p} set={set} />
        </FieldGroup>
      </details>
      <CoverageNotice />
      <details className="rounded-2xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Language & reminders
        </summary>
        <FieldGroup className="mt-5">
          <SelectField
            label="Assistant language preference"
            value={p.lang}
            options={{ en: "English", fil: "Filipino / Taglish" }}
            unknown={false}
            onChange={(value) => set({ lang: value as Profile["lang"] })}
          />
          {(["sms", "push"] as const).map((kind) => (
            <FieldLabel
              htmlFor={`pref-${kind}`}
              key={kind}
              className="items-center text-sm"
            >
              <Checkbox
                id={`pref-${kind}`}
                checked={p.reminders.includes(kind)}
                onCheckedChange={(checked) =>
                  set({
                    reminders: checked
                      ? [...new Set([...p.reminders, kind])]
                      : p.reminders.filter((item) => item !== kind),
                  })
                }
              />
              {kind === "sms" ? "SMS preference" : "Push preference"}
            </FieldLabel>
          ))}
          <TextField
            label="Mobile number"
            type="tel"
            value={p.mobile}
            onChange={(event) => set({ mobile: event.target.value })}
            autoComplete="tel"
          />
        </FieldGroup>
      </details>
    </FieldGroup>
  )
}

export function label(key: keyof typeof LABELS, value: string) {
  return value === "unknown"
    ? "Not sure yet"
    : ((LABELS[key] as Record<string, string>)[value] ?? "Not provided")
}

function CoverageNotice() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" size="sm" />}>
        <Info data-icon="inline-start" />
        Coverage & sources
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Coverage & sources</DialogTitle>
          <DialogDescription>
            Requirements and local guidance need confirmation with the issuing
            office. Current rules have not completed source review.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
