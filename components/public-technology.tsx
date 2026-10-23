import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import type { ReactElement } from "react"

type Technology = {
  name: string
  href: string
  logo: string
  description: string
}

const integrations: Technology[] = [
  {
    name: "eGovPH SSO",
    href: "https://platforms.e.gov.ph/api-catalogs/egov-sso",
    logo: "egov.png",
    description: "Sign-in exchange for an eGovPH account.",
  },
  {
    name: "eVerify",
    href: "https://platforms.e.gov.ph/api-catalogs/everify",
    logo: "egov.png",
    description:
      "Identity matching with the face-liveness session from the browser SDK.",
  },
  {
    name: "eMessage",
    href: "https://platforms.e.gov.ph/api-catalogs/emessage",
    logo: "egov.png",
    description:
      "Owner-requested SMS reminders. A scheduled reminder service is not implied.",
  },
  {
    name: "eGov AI",
    href: "https://platforms.e.gov.ph/api-catalogs/egov-ai",
    logo: "egovai.png",
    description:
      "Business classification and document extraction adapters, with prototype fallbacks.",
  },
  {
    name: "eGovPay",
    href: "https://platforms.e.gov.ph/api-catalogs/egovpay",
    logo: "egovpay.png",
    description:
      "Payment creation and transaction-status checks. Availability depends on service access.",
  },
  {
    name: "eReport",
    href: "https://platforms.e.gov.ph/api-catalogs/ereport",
    logo: "ereport.png",
    description:
      "Submission of an owner’s report through the government-service adapter.",
  },
]

const technologies: Technology[] = [
  {
    name: "Next.js",
    href: "https://nextjs.org",
    logo: "nextjs.ico",
    description: "Public pages, application routes, and server endpoints.",
  },
  {
    name: "React",
    href: "https://react.dev",
    logo: "react.png",
    description: "Interactive components and the workspace interface.",
  },
  {
    name: "TypeScript",
    href: "https://www.typescriptlang.org",
    logo: "typescript.png",
    description: "Types for business data and application code.",
  },
  {
    name: "Tailwind CSS",
    href: "https://tailwindcss.com",
    logo: "tailwind.png",
    description: "Responsive styling and Hermit’s visual system.",
  },
  {
    name: "shadcn/ui",
    href: "https://ui.shadcn.com",
    logo: "shadcn.png",
    description: "Locally owned interface components built with Base UI.",
  },
  {
    name: "Supabase",
    href: "https://supabase.com",
    logo: "supabase.png",
    description: "Server data and document storage when configured.",
  },
  {
    name: "Motion",
    href: "https://motion.dev",
    logo: "motion.svg",
    description: "Small, accessible entrance and scroll animations.",
  },
  {
    name: "Lucide",
    href: "https://lucide.dev",
    logo: "lucide.svg",
    description: "Consistent interface icons.",
  },
  {
    name: "Google Maps",
    href: "https://developers.google.com/maps",
    logo: "googlemaps.png",
    description: "Geocoding and Places search for the office-finding flow.",
  },
  {
    name: "AssemblyAI LLM Gateway",
    href: "https://www.assemblyai.com/docs/llm-gateway/overview",
    logo: "assemblyai.svg",
    description:
      "Language-model requests for the assistant and form preparation. This is distinct from voice transcription.",
  },
]

function TechnologyCard({ item }: { item: Technology }): ReactElement {
  return (
    <a
      href={item.href}
      className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-brand/40 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <Image
        src={`/brand/technology/${item.logo}`}
        alt=""
        width={144}
        height={48}
        unoptimized
        className="h-12 w-36 object-contain object-left"
      />
      <h3 className="mt-5 flex items-center justify-between gap-2 text-base font-medium">
        {item.name}
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {item.description}
      </p>
    </a>
  )
}

export function PublicIntegrations(): ReactElement {
  return (
    <section aria-labelledby="integrations-title">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase">
        Connected building blocks
      </p>
      <h2
        id="integrations-title"
        className="mt-4 text-3xl font-medium tracking-tight"
      >
        Government-service integrations
      </h2>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
        These services have code paths in the prototype through the{" "}
        <a
          href="https://github.com/omsimos/egov.js"
          className="underline underline-offset-4"
        >
          egov.js community SDK
        </a>
        . Configuration determines whether an adapter uses a live endpoint or a
        mock response. This list does not certify production access or
        successful live testing.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((item) => (
          <TechnologyCard key={item.name} item={item} />
        ))}
      </div>
      <p className="mt-5 rounded-2xl bg-canvas px-6 py-5 text-sm leading-relaxed text-muted-foreground">
        <a
          href="https://platforms.e.gov.ph/api-catalogs/egovchain"
          className="font-medium text-foreground underline underline-offset-4"
        >
          eGovChain
        </a>{" "}
        is an unimplemented placeholder. Document anchoring is not connected.
        The parent eGovPH logo identifies services without a separately sourced
        logo.
      </p>
    </section>
  )
}

export function PublicTechnology(): ReactElement {
  return (
    <section aria-labelledby="technology-title">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase">
        Under the hood
      </p>
      <h2
        id="technology-title"
        className="mt-4 text-3xl font-medium tracking-tight"
      >
        The tools behind Hermit
      </h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        A working web application built with open-source libraries and
        configured services. Each link leads to the project or provider.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {technologies.map((item) => (
          <TechnologyCard key={item.name} item={item} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 rounded-2xl bg-canvas p-6 sm:grid-cols-2">
        <div>
          <h3 className="font-medium">Document and interface tooling</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <a href="https://pdf-lib.js.org" className="underline">
              pdf-lib
            </a>{" "}
            writes PDFs;{" "}
            <a href="https://mozilla.github.io/pdf.js/" className="underline">
              PDF.js
            </a>{" "}
            renders them;{" "}
            <a href="https://github.com/unjs/unpdf" className="underline">
              unpdf
            </a>{" "}
            extracts text.{" "}
            <a
              href="https://github.com/soldair/node-qrcode"
              className="underline"
            >
              node-qrcode
            </a>{" "}
            renders payment QR codes.{" "}
            <a href="https://base-ui.com" className="underline">
              Base UI
            </a>
            ,{" "}
            <a href="https://daypicker.dev" className="underline">
              React DayPicker
            </a>
            , and{" "}
            <a href="https://date-fns.org" className="underline">
              date-fns
            </a>{" "}
            support controls and dates.
          </p>
        </div>
        <div>
          <h3 className="font-medium">Development and preparation</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <a href="https://tesseract.projectnaptha.com" className="underline">
              Tesseract.js
            </a>{" "}
            and{" "}
            <a
              href="https://github.com/Brooooooklyn/canvas"
              className="underline"
            >
              @napi-rs/canvas
            </a>{" "}
            support form-preparation scripts. They are not a promise of browser
            OCR.{" "}
            <a href="https://eslint.org" className="underline">
              ESLint
            </a>{" "}
            and{" "}
            <a href="https://prettier.io" className="underline">
              Prettier
            </a>{" "}
            support code checks and formatting.
          </p>
        </div>
      </div>
    </section>
  )
}

export function PublicGovernmentSources(): ReactElement {
  const agencies = [
    {
      name: "Department of Trade and Industry",
      acronym: "DTI",
      file: "dti",
      href: "https://bnrs.dti.gov.ph/",
    },
    {
      name: "Bureau of Internal Revenue",
      acronym: "BIR",
      file: "bir",
      href: "https://www.bir.gov.ph/",
    },
    {
      name: "Securities and Exchange Commission",
      acronym: "SEC",
      file: "sec",
      href: "https://www.sec.gov.ph/",
    },
    {
      name: "Cooperative Development Authority",
      acronym: "CDA",
      file: "cda",
      href: "https://cda.gov.ph/",
    },
  ]
  return (
    <section aria-labelledby="government-title">
      <h2 id="government-title" className="text-3xl font-medium tracking-tight">
        Official sources to return to
      </h2>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
        These agencies are references for business guidance, not Hermit
        partners. Logos identify the source; they do not imply endorsement or
        verified coverage. Confirm requirements directly with the issuing
        office.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {agencies.map((agency) => (
          <a
            key={agency.file}
            href={agency.href}
            className="flex items-center gap-5 rounded-2xl border border-border/70 bg-white p-5 text-slate-900 hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Image
              src={`/brand/agencies/${agency.file}.png`}
              alt=""
              width={112}
              height={64}
              className="h-16 w-28 shrink-0 object-contain"
            />
            <span className="text-sm leading-relaxed">
              <strong className="block font-medium">{agency.acronym}</strong>
              {agency.name}
            </span>
          </a>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Asset provenance:{" "}
        <a
          href="/brand/technology/sources.json"
          className="underline underline-offset-4"
        >
          technology and service logos
        </a>
        ;{" "}
        <a
          href="https://github.com/cadornajansen/Hermit/blob/main/docs/SOURCES.md#landing-page-agency-logos"
          className="underline underline-offset-4"
        >
          government reference logos
        </a>
        .
      </p>
    </section>
  )
}
