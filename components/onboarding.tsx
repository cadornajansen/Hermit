"use client"

import { BadgeCheck, Briefcase, Package, Store, UtensilsCrossed } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { classifyBusiness } from "@/app/actions"
import { EgovLogin, NationalIdCheck } from "@/components/egov-auth"
import { Button } from "@/components/ui/button"
import { buildChecklist, diffChecklists, EMPTY_PROFILE } from "@/lib/engine"
import { PILOT_CITY } from "@/lib/offices"
import { update, useHermit } from "@/lib/store"
import type { Flag, Profile } from "@/lib/types"
import { cn } from "@/lib/utils"

export type IdentityPrefill = Pick<
  Profile,
  "ownerName" | "birthDate" | "homeAddress" | "mobile" | "email" | "barangay" | "city" | "identityVerified"
>

// Every label here maps 1:1 to a value the engine reads (PRD §4: nothing is
// asked that does not change the checklist).
export const LABELS = {
  category: {
    retail: "Sari-sari store / maliit na tindahan",
    food_service: "Carinderia, restaurant, café, food cart",
    packaged_food: "Gumagawa o nagre-repack ng pagkain para ibenta sa tindahan",
    other: "Iba pa · Something else",
  },
  stage: {
    planning: "Nagpaplano pa lang · Planning to start",
    operating_unregistered: "Tumatakbo na pero hindi pa rehistrado · Operating, not registered",
    registered: "Rehistrado na, gusto lang manatiling compliant · Registered",
  },
  structure: {
    sole: "Ako lang · Sole proprietorship",
    partnership: "May kasosyo · Partnership",
    corporation: "Corporation / One Person Corporation",
    cooperative: "Kooperatiba · Cooperative",
  },
  premises: { home: "Sa bahay · Home-based", rented: "Nirerentahan · Rented", owned: "Sariling puwesto · Own property" },
  channel: {
    physical: "Pisikal na tindahan · Physical store",
    online: "Online lang · Online only",
    both: "Pareho · Both",
    mobile: "Delivery / mobile",
  },
  assets: { under_3m: "Wala pang ₱3M", "3m_15m": "₱3M – ₱15M", "15m_100m": "₱15M – ₱100M" },
  sales: { under_500k: "Wala pang ₱500K kada taon", "500k_3m": "₱500K – ₱3M", over_3m: "Higit ₱3M (VAT)" },
  taxOption: { "8pct": "8% flat tax", graduated: "Graduated rates" },
  employees: { none: "Wala, ako lang", "1_9": "1 – 9", "10_99": "10 – 99", "100_plus": "100+" },
} as const

export const FLAG_LABELS: Record<Flag, string> = {
  food: "Pagkain o inumin · Food or drinks",
  fda: "Gamot, cosmetics, supplements, medical devices",
  alcohol: "Alak o sigarilyo · Alcohol or tobacco",
  fuel: "Gasolina / LPG",
  security: "Baril, security services",
  lending: "Pautang, remittance, pawnshop",
  import_export: "Import / export",
  transport: "Transport / delivery service",
  construction: "Construction",
  professional: "Professional services (PRC-licensed)",
}

// Only the flags a category suggests (PRD §4 step 9).
const FLAGS_FOR: Record<string, Flag[]> = {
  retail: ["food", "alcohol", "fda", "fuel"],
  food_service: ["alcohol"],
  packaged_food: ["alcohol", "import_export"],
}

const STEPS = ["identity", "business", "stage", "structure", "where", "channel", "size", "people", "flags", "have", "prefs", "review"] as const
type Step = (typeof STEPS)[number]

const input = "h-11 w-full rounded-xl border bg-background px-3 text-base"

export function Onboarding({ identity, sso, authError }: { identity: IdentityPrefill | null; sso: boolean; authError?: string }) {
  const { ready, synced, profile } = useHermit()
  if (!ready || !synced) return null
  return <Wizard saved={profile} identity={identity} sso={sso} authError={authError} />
}

function Wizard({
  saved,
  identity,
  sso,
  authError,
}: {
  saved: Profile | null
  identity: IdentityPrefill | null
  sso: boolean
  authError?: string
}) {
  const router = useRouter()
  const [p, setP] = useState<Profile>(() => {
    const base = saved ?? { ...EMPTY_PROFILE, city: PILOT_CITY }
    if (!identity) return base
    return {
      ...base,
      ...identity,
      barangay: base.barangay || identity.barangay,
      city: (saved && base.city) || identity.city || base.city,
    }
  })
  const [step, setStep] = useState<Step>(saved && !(sso && !saved.identityVerified) ? "review" : "identity")
  const [guess, setGuess] = useState<string>()
  const [classifying, startClassify] = useTransition()
  const set = (patch: Partial<Profile>) => setP((prev) => ({ ...prev, ...patch }))
  const i = STEPS.indexOf(step)
  const go = (d: number) => setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, i + d))])

  function save() {
    update(() => ({ profile: p, lastDiff: saved ? diffChecklists(saved, p) : null }))
    router.push("/dashboard")
  }

  const startItems = buildChecklist(p, {}).filter((r) => r.group === "start")
  const flags = p.category in FLAGS_FOR ? FLAGS_FOR[p.category] : (Object.keys(FLAG_LABELS) as Flag[])

  const screens: Record<Step, React.ReactNode> = {
    identity: (
      <Screen title="Sino ka? · Who are you?" help="Kinukuha namin ang pangalan, birthday at address mo sa National ID para hindi mo na i-type ulit sa bawat form.">
        {authError && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{authError}</p>}
        {p.identityVerified ? (
          <div className="flex gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">Verified sa National ID{sso ? " · naka-sign in sa eGovPH" : ""}</p>
              <p>{p.ownerName}</p>
              <p className="text-muted-foreground">
                {p.birthDate} · {p.homeAddress}
              </p>
            </div>
          </div>
        ) : sso ? (
          <>
            <div className="rounded-xl border p-4 text-sm">
              <p className="font-medium">Naka-sign in gamit ang eGovPH</p>
              <p>{p.ownerName}</p>
              <p className="text-muted-foreground">
                {p.birthDate} · {p.homeAddress}
              </p>
            </div>
            <NationalIdCheck profile={p} sso onVerified={(patch) => set(patch)} />
          </>
        ) : (
          <>
            <EgovLogin />
            <p className="text-center text-xs text-muted-foreground">o kaya, i-type at i-verify gamit ang National ID</p>
            <Field label="Buong pangalan · Full name (as on your ID)">
              <input className={input} value={p.ownerName} onChange={(e) => set({ ownerName: e.target.value })} autoComplete="name" />
            </Field>
            <Field label="Kaarawan · Birthday">
              <input type="date" className={input} value={p.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
            </Field>
            <NationalIdCheck profile={p} sso={false} onVerified={(patch) => set(patch)} />
            <Field label="Tirahan · Home address">
              <input className={input} value={p.homeAddress} onChange={(e) => set({ homeAddress: e.target.value })} autoComplete="street-address" />
            </Field>
            <Field label="Email (optional)">
              <input type="email" className={input} value={p.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
            </Field>
            <p className="text-xs text-muted-foreground">
              Paalala: dapat pareho ang pangalan mo sa DTI, BIR at permits — kung hindi, puwedeng ma-reject ang filing. Puwede
              kang magpatuloy kahit hindi pa verified.
            </p>
          </>
        )}
      </Screen>
    ),
    business: (
      <Screen title="Ano ang negosyo mo? · What does your business do?">
        <Field label="Pangalan ng negosyo (kung meron na) · Business name">
          <input className={input} value={p.businessName} onChange={(e) => set({ businessName: e.target.value })} />
        </Field>
        <Field label='Ikuwento sa sariling salita, hal. "nagtitinda ako ng lutong ulam"'>
          <textarea className={cn(input, "h-24 py-2")} value={p.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Button
          variant="secondary"
          disabled={!p.description.trim() || classifying}
          onClick={() =>
            startClassify(async () => {
              const c = await classifyBusiness(p.description)
              if (!c) return
              set({ category: c.category, psic: c.psic })
              setGuess(`${c.label}${c.psic ? ` (PSIC ${c.psic})` : ""}`)
            })
          }
        >
          {classifying ? "Sandali…" : "Hulaan ang category · Suggest a category"}
        </Button>
        {guess && <p className="text-sm">Mukhang: <strong>{guess}</strong>. Tama ba? Piliin sa baba.</p>}
        <Choice
          value={p.category}
          onChange={(category) => set({ category })}
          options={LABELS.category}
          icons={{ retail: Store, food_service: UtensilsCrossed, packaged_food: Package, other: Briefcase }}
        />
      </Screen>
    ),
    stage: (
      <Screen title="Nasaan ka na? · Where are you now?">
        <Choice value={p.stage} onChange={(stage) => set({ stage })} options={LABELS.stage} />
      </Screen>
    ),
    structure: (
      <Screen title="Sino ang may-ari? · Who owns it?" help="Ito ang nagsasabi kung sa DTI (sole proprietor), SEC (partnership/corporation) o CDA (kooperatiba) ka magrerehistro.">
        <Choice value={p.structure} onChange={(structure) => set({ structure })} options={LABELS.structure} />
      </Screen>
    ),
    where: (
      <Screen title="Saan ang negosyo? · Where is it?" help="Ang address ang nagsasabi kung aling barangay, city hall at BIR RDO (Revenue District Office) ang may hawak sa iyo.">
        <Field label="Address ng negosyo · Business address">
          <input className={input} value={p.businessAddress} onChange={(e) => set({ businessAddress: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Barangay">
            <input className={input} value={p.barangay} onChange={(e) => set({ barangay: e.target.value })} />
          </Field>
          <Field label="City / municipality">
            <input className={input} value={p.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
        </div>
        <p className="text-sm font-medium">Ang puwesto ay… · The place is…</p>
        <Choice value={p.premises} onChange={(premises) => set({ premises })} options={LABELS.premises} />
      </Screen>
    ),
    channel: (
      <Screen title="Paano ka nagbebenta? · How do you sell?" help="Kahit online lang o home-based, kailangan pa rin ng Mayor's Permit at BIR registration.">
        <Choice value={p.channel} onChange={(channel) => set({ channel })} options={LABELS.channel} />
      </Screen>
    ),
    size: (
      <Screen title="Gaano kalaki? · How big?" help="Assets decide BMBE eligibility (₱3M pababa, hindi kasama ang lupa). Sales decide 8% vs graduated tax and VAT vs non-VAT.">
        <p className="text-sm font-medium">Kabuuang assets (hindi kasama ang lupa)</p>
        <Choice value={p.assets} onChange={(assets) => set({ assets })} options={LABELS.assets} />
        <p className="text-sm font-medium">Tantiyang benta kada taon · Yearly sales</p>
        <Choice value={p.sales} onChange={(sales) => set({ sales })} options={LABELS.sales} />
        {p.structure === "sole" && p.sales !== "over_3m" && (
          <>
            <p className="text-sm font-medium">Income tax option (kung alam mo na)</p>
            <Choice value={p.taxOption} onChange={(taxOption) => set({ taxOption })} options={LABELS.taxOption} />
          </>
        )}
      </Screen>
    ),
    people: (
      <Screen title="May empleyado ka ba? · Do you have employees?" help="Kahit isang helper ay nagdadagdag ng SSS, PhilHealth, Pag-IBIG at DOLE.">
        <Choice value={p.employees} onChange={(employees) => set({ employees })} options={LABELS.employees} />
      </Screen>
    ),
    flags: (
      <Screen title="Alin dito ang ginagawa mo? · Any of these?" help="Ang mga ito ay may dagdag na permit mula sa ibang ahensya.">
        {flags.map((f) => (
          <div key={f} className="flex flex-col gap-2">
            <p className="text-sm">{FLAG_LABELS[f]}</p>
            <Choice
              value={p.flags[f] === undefined ? "" : String(p.flags[f])}
              onChange={(v) => set({ flags: { ...p.flags, [f]: v === "unknown" ? "unknown" : v === "true" } })}
              options={{ true: "Oo", false: "Hindi" }}
              row
            />
          </div>
        ))}
      </Screen>
    ),
    have: (
      <Screen title="Ano na ang hawak mo? · What do you already have?" help="Lagyan ng check ang mga dokumentong meron ka na.">
        {startItems.map((r) => (
          <label key={r.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm has-checked:border-primary">
            <input
              type="checkbox"
              className="size-5 accent-(--primary)"
              checked={p.have.includes(r.id)}
              onChange={(e) =>
                set({ have: e.target.checked ? [...p.have, r.id] : p.have.filter((h) => h !== r.id) })
              }
            />
            {r.name}
          </label>
        ))}
      </Screen>
    ),
    prefs: (
      <Screen title="Paalala at wika · Reminders and language">
        <Choice value={p.lang} onChange={(lang) => set({ lang: lang as Profile["lang"] })} options={{ fil: "Filipino / Taglish", en: "English" }} unknown={false} row />
        {(["sms", "push"] as const).map((r) => (
          <label key={r} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-(--primary)"
              checked={p.reminders.includes(r)}
              onChange={(e) =>
                set({ reminders: e.target.checked ? [...p.reminders, r] : p.reminders.filter((x) => x !== r) })
              }
            />
            {r === "sms" ? "SMS (gumagana kahit walang data)" : "Push notifications"}
          </label>
        ))}
        <Field label="Mobile number para sa SMS">
          <input type="tel" className={input} placeholder="+639171234567" value={p.mobile} onChange={(e) => set({ mobile: e.target.value })} autoComplete="tel" />
        </Field>
      </Screen>
    ),
    review: (
      <Screen title="Tama ba ito? · Is this right?">
        <p className="rounded-xl bg-muted p-4 text-base">{summary(p)}</p>
        <ul className="flex flex-col divide-y rounded-xl border">
          {(
            [
              ["identity", "Owner", p.ownerName || "—"],
              ["business", "Negosyo", `${p.businessName || "—"} · ${label("category", p.category)}`],
              ["stage", "Stage", label("stage", p.stage)],
              ["structure", "Ownership", label("structure", p.structure)],
              ["where", "Lugar", [p.businessAddress, p.barangay && `Brgy. ${p.barangay}`, p.city].filter(Boolean).join(", ") || "—"],
              ["channel", "Pagbebenta", label("channel", p.channel)],
              ["size", "Laki", `${label("assets", p.assets)} · ${label("sales", p.sales)}`],
              ["people", "Empleyado", label("employees", p.employees)],
              ["have", "Hawak na", `${p.have.length} dokumento`],
            ] as [Step, string, string][]
          ).map(([s, k, v]) => (
            <li key={s} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                <span className="block text-xs text-muted-foreground">{k}</span>
                {v}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setStep(s)}>
                I-edit
              </Button>
            </li>
          ))}
        </ul>
      </Screen>
    ),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">HERMIT</span>
        <span>
          Hakbang {i + 1} sa {STEPS.length}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
      </div>
      {screens[step]}
      <div className="sticky bottom-0 flex gap-2 bg-background py-3">
        {i > 0 && (
          <Button variant="outline" size="lg" className="flex-1" onClick={() => go(-1)}>
            Bumalik
          </Button>
        )}
        {step === "review" ? (
          <Button size="lg" className="flex-1" onClick={save}>
            I-save · Build my checklist
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={() => go(1)} disabled={step === "identity" && !p.ownerName.trim()}>
            Susunod · Next
          </Button>
        )}
      </div>
    </div>
  )
}

type LabelKey = keyof typeof LABELS
export function label(key: LabelKey, v: string) {
  return v === "unknown" ? "Hindi alam" : ((LABELS[key] as Record<string, string>)[v] ?? "—")
}

function summary(p: Profile) {
  const who = p.structure === "unknown" ? "Negosyo" : label("structure", p.structure).split(" · ").pop()
  const where = [p.barangay && `Brgy. ${p.barangay}`, p.city].filter(Boolean).join(", ")
  const people = p.employees === "none" ? "walang empleyado" : p.employees === "unknown" ? "" : `${label("employees", p.employees)} empleyado`
  const kind = p.category === "unknown" ? "business" : label("category", p.category).split(",")[0].toLowerCase()
  return [`${who}, ${p.premises === "home" ? "home-based " : ""}${kind}`, where && `sa ${where}`, people].filter(Boolean).join(" · ")
}

function Screen({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      {help && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer text-primary">Bakit tinatanong ito? · Why we ask</summary>
          <p className="mt-1">{help}</p>
        </details>
      )}
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label}
      {children}
    </label>
  )
}

function Choice<T extends string>({
  value,
  onChange,
  options,
  icons,
  unknown = true,
  row = false,
}: {
  value: string
  onChange: (v: T | "unknown") => void
  options: Readonly<Record<T, string>>
  icons?: Partial<Record<string, React.ComponentType<{ className?: string }>>>
  unknown?: boolean
  row?: boolean
}) {
  const all = { ...options, ...(unknown ? { unknown: "Hindi ko alam · I don't know" } : {}) }
  return (
    <div role="radiogroup" className={cn("flex gap-2", row ? "flex-wrap" : "flex-col")}>
      {Object.entries(all).map(([v, text]) => {
        const Icon = icons?.[v]
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v as T | "unknown")}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2 text-left text-sm transition-colors",
              row && "flex-1 justify-center",
              value === v ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
              v === "unknown" && "text-muted-foreground"
            )}
          >
            {Icon && <Icon className="size-5 shrink-0 text-primary" />}
            {text}
          </button>
        )
      })}
    </div>
  )
}
