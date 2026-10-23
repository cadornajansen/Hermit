import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Info,
  Landmark,
  MapPin,
  Plus,
  ReceiptText,
  Store,
} from "lucide-react"
import Link from "next/link"
import type { ReactElement } from "react"

import { LandingReveal } from "@/components/landing-reveal"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function BusinessPreview(): ReactElement {
  return (
    <div className="absolute inset-x-[12%] top-10 -rotate-3 rounded-xl border border-border/70 bg-card p-4 shadow-[0_12px_30px_-14px_rgba(30,65,110,0.25)]">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Store className="size-4 text-brand" />
        Your business
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Business activities
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-medium text-secondary-foreground">
        <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
          <Check className="size-3" /> Retail
        </span>
        <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
          <Check className="size-3" /> Food service
        </span>
      </div>
      <p className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2.5 text-[10px] text-muted-foreground">
        <MapPin className="size-3" /> City of Manila
      </p>
    </div>
  )
}

function RoadmapPreview(): ReactElement {
  return (
    <div className="absolute inset-x-[10%] top-10 rotate-2 rounded-xl border border-border/70 bg-card p-4 shadow-[0_12px_30px_-14px_rgba(30,65,110,0.25)]">
      <p className="text-xs font-medium text-foreground">Your roadmap</p>
      <div className="relative mt-3 space-y-3 border-l border-border pl-4 text-[10px]">
        <div>
          <span className="absolute top-1 -left-1 size-2 rounded-full bg-brand" />
          <p className="font-medium text-foreground">Business registration</p>
          <p className="mt-0.5 text-brand">In progress</p>
        </div>
        <div>
          <span className="absolute bottom-3 -left-1 size-2 rounded-full border border-border bg-card" />
          <p className="font-medium text-foreground">Local business permit</p>
          <p className="mt-0.5 text-muted-foreground">Prerequisite needed</p>
        </div>
      </div>
      <p className="absolute -right-2 -bottom-3 flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2 text-[10px] text-secondary-foreground shadow-sm">
        <BookOpen className="size-3" /> Source links included
      </p>
    </div>
  )
}

function ProgressPreview(): ReactElement {
  return (
    <div className="absolute inset-x-[12%] top-10 -rotate-2 rounded-xl border border-border/70 bg-card p-4 shadow-[0_12px_30px_-14px_rgba(30,65,110,0.25)]">
      <p className="text-[10px] font-medium text-brand">Next action</p>
      <p className="mt-1 text-xs font-medium text-foreground">
        Prepare your documents
      </p>
      <div className="mt-3 flex gap-1.5">
        <span className="h-1.5 flex-1 rounded-full bg-brand" />
        <span className="h-1.5 flex-1 rounded-full bg-brand/60" />
        <span className="h-1.5 flex-1 rounded-full bg-secondary" />
        <span className="h-1.5 flex-1 rounded-full bg-secondary" />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Check className="size-3 text-brand" /> Completed
        </span>
        <span className="flex items-center gap-1">
          <Circle className="size-2.5" /> To do
        </span>
      </div>
      <p className="absolute -right-3 -bottom-4 rounded-lg border border-border/70 bg-card px-3 py-2 text-[10px] text-muted-foreground shadow-sm">
        Your progress, in one place
      </p>
    </div>
  )
}

export function HowItWorksPreview({ step }: { step: number }): ReactElement {
  return (
    <LandingReveal className="relative h-full w-full bg-secondary select-none">
      <div className="absolute inset-x-[14%] top-12 h-32 rotate-6 rounded-xl bg-sky/70" />
      <p className="absolute top-3 left-4 text-[9px] font-medium tracking-wider text-muted-foreground uppercase">
        Illustrative preview
      </p>
      {step === 0 ? (
        <BusinessPreview />
      ) : step === 1 ? (
        <RoadmapPreview />
      ) : (
        <ProgressPreview />
      )}
    </LandingReveal>
  )
}

function NextActionPreview(): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="relative h-72 overflow-hidden bg-secondary/70 select-none sm:h-80"
    >
      <p className="absolute top-5 left-6 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        Example roadmap
      </p>
      <div className="absolute top-16 right-[12%] h-44 w-32 rotate-12 rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <FileText className="size-7 text-brand/60" strokeWidth={1.5} />
        <div className="mt-5 space-y-2">
          <div className="h-1.5 rounded-full bg-secondary" />
          <div className="h-1.5 w-4/5 rounded-full bg-secondary" />
          <div className="h-1.5 w-3/5 rounded-full bg-secondary" />
        </div>
      </div>
      <div className="absolute top-16 left-[9%] w-[70%] -rotate-3 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_16px_40px_-20px_rgba(30,65,110,0.3)] sm:top-20 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-medium text-brand">
          <span className="size-1.5 rounded-full bg-brand" /> Next action
        </p>
        <p className="mt-3 max-w-48 text-lg leading-snug font-medium tracking-tight text-foreground sm:text-xl">
          Review business registration
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Your roadmap starts here.
        </p>
        <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <FileText className="size-3.5 text-brand" /> See what to prepare
          <ArrowRight className="ml-auto size-3.5" />
        </div>
      </div>
      <div className="absolute right-[7%] bottom-6 flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-xs text-foreground shadow-sm sm:bottom-9">
        <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-brand">
          <Check className="size-3.5" />
        </span>
        Progress you can see
      </div>
    </div>
  )
}

function UpcomingDatesPreview(): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="relative h-72 overflow-hidden bg-canvas select-none sm:h-80"
    >
      <p className="absolute top-5 left-6 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        Example calendar
      </p>
      <div className="absolute top-14 left-[11%] w-[66%] -rotate-3 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_16px_40px_-20px_rgba(30,65,110,0.25)] sm:top-16 sm:p-5">
        <p className="flex items-center justify-between text-xs font-medium text-foreground">
          Your calendar <CalendarDays className="size-4 text-brand" />
        </p>
        <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-[10px]">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <span key={day} className="pb-1 text-muted-foreground">
              {day}
            </span>
          ))}
          {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
            <span
              key={day}
              className={
                day === 18
                  ? "mx-auto flex size-5 items-center justify-center rounded-full bg-brand text-white"
                  : "flex h-5 items-center justify-center text-muted-foreground"
              }
            >
              {day}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute right-[7%] bottom-7 w-[53%] rotate-3 rounded-xl border border-border/60 bg-card p-4 shadow-[0_12px_30px_-16px_rgba(30,65,110,0.25)] sm:bottom-10">
        <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-secondary text-brand">
          <Clock3 className="size-4" />
        </div>
        <p className="text-xs font-medium text-foreground">Recorded expiry</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          A date you add to your roadmap
        </p>
      </div>
    </div>
  )
}

function RequirementPreview(): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="relative flex min-h-72 items-end justify-center overflow-hidden bg-secondary/60 px-6 pt-14 select-none sm:min-h-80 sm:px-10"
    >
      <p className="absolute top-5 left-6 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        Example requirement
      </p>
      <div className="w-full max-w-sm translate-y-3 -rotate-2 rounded-t-2xl border border-border/60 bg-card p-5 shadow-[0_16px_40px_-20px_rgba(30,65,110,0.25)] sm:p-6">
        <p className="flex items-center gap-2 text-xs font-medium text-brand">
          <FileText className="size-4" /> Requirement details
        </p>
        <p className="mt-3 text-lg font-medium tracking-tight text-foreground">
          Local business permit
        </p>
        <p className="mt-1 text-xs text-muted-foreground">City of Manila</p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/70 pt-4 text-[11px]">
          <div>
            <p className="font-medium text-foreground">What to prepare</p>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">
              Supporting documents for your business
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Complete first</p>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">
              Check prerequisite requirements
            </p>
          </div>
        </div>
        <p className="mt-5 flex items-center gap-2 rounded-lg bg-secondary/70 px-3 py-2.5 text-xs text-secondary-foreground">
          <BookOpen className="size-3.5" /> Official source information
        </p>
      </div>
    </div>
  )
}

function ProductPhilosophy(): ReactElement {
  return (
    <section
      aria-labelledby="philosophy-title"
      className="mx-auto max-w-6xl px-6 pt-10 pb-24 sm:px-10 sm:pt-16 sm:pb-28"
    >
      <LandingReveal className="grid gap-8 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="text-xs font-semibold tracking-widest text-brand uppercase">
            A little less to carry
          </p>
          <h2
            id="philosophy-title"
            className="mt-4 max-w-lg text-3xl leading-[1.1] font-medium tracking-[-0.045em] text-balance sm:text-5xl"
          >
            Your business deserves more of your attention.
          </h2>
        </div>
        <div className="lg:pt-8">
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Running a business already takes enough. Scattered requirements,
            unfamiliar terms, and wondering what you might have missed shouldn’t
            take over your day.
          </p>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Hermit brings relevant steps into one roadmap, so there’s less to
            untangle and a clearer place to start.
          </p>
          <ul className="mt-7 space-y-3 text-sm font-medium">
            {[
              "Less jargon. Clearer next steps.",
              "Dates you can see and prepare for.",
              "More headspace for the business.",
            ].map((idea) => (
              <li key={idea} className="flex items-center gap-3">
                <Check
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand"
                />
                {idea}
              </li>
            ))}
          </ul>
        </div>
      </LandingReveal>
    </section>
  )
}

function ProductBenefits(): ReactElement {
  return (
    <section aria-labelledby="benefits-title" className="bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-24">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase">
            One place to find your footing
          </p>
          <h2
            id="benefits-title"
            className="mt-4 text-3xl leading-[1.1] font-medium tracking-[-0.045em] text-balance sm:text-5xl"
          >
            A clearer view of what comes next.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            From the first requirement to the next date, keep the details
            connected.
          </p>
        </LandingReveal>
        <LandingReveal scale className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="overflow-hidden rounded-[2rem] border border-border/50 bg-card">
            <NextActionPreview />
            <div className="px-7 pt-7 pb-8 sm:px-8">
              <h3 className="text-2xl font-medium tracking-[-0.035em]">
                Know what needs attention.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                See your next action alongside your tracked progress. Find a
                place to begin without piecing everything together again.
              </p>
            </div>
          </article>
          <article className="overflow-hidden rounded-[2rem] border border-border/50 bg-card">
            <UpcomingDatesPreview />
            <div className="px-7 pt-7 pb-8 sm:px-8">
              <h3 className="text-2xl font-medium tracking-[-0.035em]">
                Make room to prepare.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Bring upcoming dates and the document expiries you record into
                view, so you can plan ahead with less last-minute worry.
              </p>
            </div>
          </article>
          <article className="grid overflow-hidden rounded-[2rem] border border-border/50 bg-card md:col-span-2 lg:grid-cols-2">
            <div className="order-last flex flex-col justify-center px-7 py-8 sm:px-8 lg:order-first lg:p-10">
              <h3 className="max-w-sm text-2xl leading-tight font-medium tracking-[-0.035em] sm:text-3xl">
                Understand the step in front of you.
              </h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                See what to prepare, which earlier steps matter, and where the
                source information comes from. Less unfamiliar paperwork. More
                context for your next move.
              </p>
            </div>
            <RequirementPreview />
          </article>
        </LandingReveal>
      </div>
    </section>
  )
}

function SourceLink({
  href,
  label,
}: {
  href: string
  label: string
}): ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {label}
      <ExternalLink aria-hidden="true" className="size-3" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

function GovernmentGuidance(): ReactElement {
  return (
    <section
      aria-labelledby="guidance-title"
      className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28"
    >
      <LandingReveal className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="text-xs font-semibold tracking-widest text-brand uppercase">
            The terms, made simpler
          </p>
          <h2
            id="guidance-title"
            className="mt-4 max-w-lg text-3xl leading-[1.1] font-medium tracking-[-0.045em] text-balance sm:text-5xl"
          >
            Government compliance, made understandable.
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Different offices handle different parts of running a business.
            Hermit helps you understand the terms and keep relevant steps
            together.
          </p>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            These are different responsibilities, not one fixed filing order.
            What applies depends on your business.
          </p>
        </div>
        <div className="divide-y divide-border/70">
          <article className="flex gap-4 pb-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
              <Building2
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.5}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-medium tracking-tight">
                Business registration
              </h3>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <strong className="font-medium text-foreground">
                    One owner (sole proprietor):
                  </strong>{" "}
                  the Department of Trade and Industry (DTI) registers business
                  names.
                </li>
                <li>
                  <strong className="font-medium text-foreground">
                    Corporations and partnerships:
                  </strong>{" "}
                  registration is handled by the Securities and Exchange
                  Commission (SEC).
                </li>
                <li>
                  <strong className="font-medium text-foreground">
                    Cooperatives:
                  </strong>{" "}
                  register through the Cooperative Development Authority (CDA).
                </li>
              </ul>
              <div className="mt-2 flex flex-wrap gap-x-5">
                <SourceLink
                  href="https://dtiwebfiles.s3-ap-southeast-1.amazonaws.com/FAQs%20on%20DTI%20Services%20as%20of%20Aug%202022.pdf#page=6"
                  label="DTI guidance"
                />
                <SourceLink
                  href="https://esparc.sec.gov.ph/application/selection"
                  label="SEC guidance"
                />
                <SourceLink
                  href="https://cda.gov.ph/frequently-asked-questions/"
                  label="CDA guidance"
                />
              </div>
            </div>
          </article>
          <article className="flex gap-4 py-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
              <ReceiptText
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.5}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-medium tracking-tight">
                Tax registration
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The Bureau of Internal Revenue (BIR) handles business tax
                registration. This is separate from registering a business name.
              </p>
              <SourceLink
                href="https://bir-cdn.bir.gov.ph/BIR/pdf/TP_Guide_on_Business_Registration.pdf"
                label="BIR registration guide"
              />
            </div>
          </article>
          <article className="flex gap-4 pt-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
              <Landmark
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.5}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-medium tracking-tight">
                Local permits and clearances
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A business name is not a permit to operate. Manila has a
                separate process for local business permits and clearances.
              </p>
              <SourceLink
                href="https://citycouncilofmanila.com.ph/city_ordinances/ordinance-no-8754-2/"
                label="Manila’s Bureau of Permits"
              />
            </div>
          </article>
        </div>
      </LandingReveal>
      <div className="mt-12 flex items-start gap-3 rounded-2xl bg-canvas px-5 py-5 sm:px-6">
        <Info
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-brand"
        />
        <div className="text-sm leading-relaxed">
          <p className="font-medium">A guide, with clear limits.</p>
          <p className="mt-1 text-muted-foreground">
            Hermit’s requirement sources still need review, and coverage varies
            by business activity. Use your roadmap to plan, and confirm current
            requirements and dates with the issuing office. Hermit is
            independent and is not affiliated with these agencies.
          </p>
        </div>
      </div>
    </section>
  )
}

const faqs = [
  {
    question: "Is Hermit for my business?",
    answer:
      "Hermit is designed for small-business owners in the City of Manila. It uses your business activities, location, and other details to suggest relevant requirements. Coverage varies by activity and is not exhaustive.",
  },
  {
    question: "Is this a government service? Will Hermit file for me?",
    answer:
      "Hermit is an independent guidance and progress-tracking tool. It does not issue permits, submit applications, or guarantee compliance. You handle submissions with the relevant office.",
  },
  {
    question: "How do I know the guidance is current?",
    answer:
      "The requirement source library still needs review. Links help you find official information, but a source link is not proof that every detail is current. Confirm requirements and dates with the issuing office.",
  },
  {
    question: "Can I come back to my progress?",
    answer:
      "Yes. In this version, your business details and progress are saved in this browser for your account. Return using the same account and browser. Your roadmap does not sync across devices, and clearing browser data can remove saved progress.",
  },
] as const

function LandingFaq(): ReactElement {
  return (
    <section
      aria-labelledby="faq-title"
      className="mx-auto max-w-4xl px-6 pt-4 pb-24 sm:px-10 sm:pt-8 sm:pb-28"
    >
      <LandingReveal>
        <h2
          id="faq-title"
          className="text-center text-3xl leading-[1.1] font-medium tracking-[-0.045em] text-balance sm:text-4xl"
        >
          A few things, made clear.
        </h2>
        <div className="mt-10 divide-y divide-border/70 border-y border-border/70">
          {faqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 rounded-sm py-5 text-left text-sm font-medium transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none sm:text-base [&::-webkit-details-marker]:hidden">
                {faq.question}
                <Plus
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-2xl pr-6 pb-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </LandingReveal>
    </section>
  )
}

function ClosingInvitation(): ReactElement {
  return (
    <section
      aria-labelledby="closing-title"
      className="mx-auto max-w-6xl px-6 pb-20 sm:px-10 sm:pb-24"
    >
      <LandingReveal
        scale
        className="rounded-[2rem] bg-secondary px-6 py-16 text-center sm:px-10 sm:py-20"
      >
        <div
          aria-hidden="true"
          className="mx-auto flex size-14 -rotate-6 items-center justify-center rounded-2xl bg-card text-brand shadow-[0_6px_16px_-8px_rgba(30,65,110,0.25)]"
        >
          <Store className="size-7" strokeWidth={1.5} />
        </div>
        <h2
          id="closing-title"
          className="mx-auto mt-7 max-w-xl text-3xl leading-[1.1] font-medium tracking-[-0.045em] text-balance sm:text-5xl"
        >
          A clearer next step starts here.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Start with your business details. Leave with a clearer place to begin.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg", variant: "ink" }),
              "gap-2.5"
            )}
          >
            Build my roadmap{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Open my roadmap <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </LandingReveal>
    </section>
  )
}

export function LandingContent(): ReactElement {
  return (
    <>
      <ProductPhilosophy />
      <ProductBenefits />
      <GovernmentGuidance />
      <LandingFaq />
      <ClosingInvitation />
    </>
  )
}
