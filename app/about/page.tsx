import Image from "next/image"
import Link from "next/link"
import type { ReactElement } from "react"

import { PublicPage } from "@/components/public-page"
import { publicMetadata } from "@/components/public-metadata"

export const metadata = publicMetadata(
  "About Hermit — A clearer next step for small businesses",
  "Meet Hermit, a hackathon prototype exploring clearer business compliance guidance for small-business owners in the City of Manila.",
  "/about"
)

export default function AboutPage(): ReactElement {
  return (
    <PublicPage
      current="/about"
      eyebrow="A little less to carry"
      title="More room for the business you’re building."
      intro="Hermit explores a simple idea: understanding business requirements should leave you with a clearer next step."
    >
      <section
        className="grid items-center gap-10 lg:grid-cols-2"
        aria-labelledby="audience-title"
      >
        <div className="overflow-hidden rounded-[2rem] bg-canvas">
          <Image
            src="/brand/business-icons.svg"
            alt="A storefront surrounded by food service, retail, repair, and professional-service icons."
            width={640}
            height={520}
            sizes="(min-width: 1024px) 520px, 100vw"
            className="h-auto w-full"
          />
        </div>
        <div>
          <h2
            id="audience-title"
            className="text-3xl font-medium tracking-tight"
          >
            Built around small-business owners.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            The project’s focus is the City of Manila: owners balancing everyday
            work with unfamiliar registrations, permits, and separate government
            offices. The intended coverage is local; the current prototype’s
            requirement library still needs review.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Hermit brings business details, suggested requirements, source
            links, and recorded progress into one place, so an owner can explore
            what to prepare and what to ask the issuing office.
          </p>
        </div>
      </section>
      <section
        aria-labelledby="purpose-title"
        className="rounded-[2rem] bg-canvas p-7 sm:p-10"
      >
        <p className="text-xs font-semibold tracking-widest text-brand uppercase">
          Why this project exists
        </p>
        <h2
          id="purpose-title"
          className="mt-4 max-w-2xl text-3xl font-medium tracking-tight"
        >
          A working idea, open to inspection.
        </h2>
        <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">
          Hermit is a hackathon prototype for CSSprint 2026. It explores how a
          guided questionnaire and a rule-based roadmap can make scattered
          requirements easier to understand. The repository includes the
          implementation and product documentation so the approach can be
          examined and improved.
        </p>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
          Hermit is independent. Agency names and source links identify relevant
          offices; they do not imply affiliation or endorsement. Completing a
          checklist does not establish legal compliance, and Hermit does not
          issue permits or file applications for you.
        </p>
        <Link
          href="/prototype"
          className="mt-6 inline-flex min-h-11 items-center rounded-sm font-medium text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          See what the prototype can do →
        </Link>
      </section>
    </PublicPage>
  )
}
