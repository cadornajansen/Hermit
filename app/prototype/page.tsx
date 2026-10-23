import Link from "next/link"
import type { ReactElement } from "react"

import { PublicPage } from "@/components/public-page"
import { publicMetadata } from "@/components/public-metadata"
import { PublicGovernmentSources, PublicIntegrations, PublicTechnology } from "@/components/public-technology"

export const metadata = publicMetadata(
  "Hermit prototype — Capabilities and current limits",
  "Explore Hermit’s current prototype, including business intake, suggested checklists, progress tracking, and the limits of its unreviewed guidance.",
  "/prototype"
)

export default function PrototypePage(): ReactElement {
  return (
    <PublicPage
      current="/prototype"
      eyebrow="Prototype, with clear limits"
      title="Explore the idea. Understand its limits."
      intro="Hermit is a working hackathon project. Screens and integrations are still evolving, and the requirement library has not yet passed source review."
    >
      <section aria-labelledby="try-title">
        <h2 id="try-title" className="text-3xl font-medium tracking-tight">
          What you can explore
        </h2>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {[
            [
              "Describe your business",
              "Enter and review business details through a guided questionnaire. Those answers help select suggested requirements.",
            ],
            [
              "Explore your roadmap",
              "Read requirement explanations, preparation details, prerequisites, and links to official sources. Coverage varies by activity.",
            ],
            [
              "Record your progress",
              "Update tracked tasks and record document expiry dates. These are your working records, not confirmation from an issuing office.",
            ],
          ].map(([title, text]) => (
            <article
              key={title}
              className="rounded-2xl border border-border/70 bg-card p-7"
            >
              <h3 className="text-xl font-medium tracking-tight">{title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section
        aria-labelledby="limits-title"
        className="grid gap-8 border-y border-border/70 py-10 lg:grid-cols-[1fr_2fr]"
      >
        <h2 id="limits-title" className="text-3xl font-medium tracking-tight">
          Before relying on it
        </h2>
        <dl className="space-y-7">
          {[
            [
              "Guidance needs review",
              "The current requirement records are research seeds. An official link does not establish that a procedure, fee, deadline, or business-specific rule is current. Confirm details with the issuing office.",
            ],
            [
              "Coverage is incomplete",
              "The product is aimed at City of Manila businesses, but the current implementation contains earlier prototype material. Selecting a business category does not mean all its obligations are covered.",
            ],
            [
              "Saving depends on the setup",
              "The app keeps a local working copy and includes server backup and restore when configured. Check save or sync messages and retain your own important records. Do not assume a change has reached your backup until the app confirms it.",
            ],
            [
              "Some integrations are simulated",
              "Government-service adapters can use mock responses. A successful demo does not prove a live government connection, identity verification, payment, or filing.",
            ],
            [
              "Additional screens are experimental",
              "Assistant, calendar, document, and form tools may appear in the app. Their presence is not a promise of verified advice, approved documents, reliable reminders, or complete support. Parts of the implementation extend beyond the documented target.",
            ],
          ].map(([title, text]) => (
            <div key={title}>
              <dt className="font-medium">{title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {text}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <PublicIntegrations />
      <PublicTechnology />
      <PublicGovernmentSources />
      <section
        className="rounded-[2rem] bg-secondary p-8 sm:p-10"
        aria-labelledby="next-title"
      >
        <h2 id="next-title" className="text-3xl font-medium tracking-tight">
          Try it with an example business.
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Explore the questionnaire and roadmap using sample details. The
          repository documents the intended direction, including reviewed
          guidance and clearer coverage boundaries; those plans are not a
          completed-feature checklist.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Explore Hermit →
        </Link>
      </section>
    </PublicPage>
  )
}
