import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import localFont from "next/font/local"

import { AgencyStrip } from "@/components/agency-strip"
import { Brand } from "@/components/brand"
import { HowItWorksPreview, LandingContent } from "@/components/landing-content"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const melodrame = localFont({
  src: "../public/fonts/Relationship of mélodrame.ttf",
  display: "swap",
  weight: "400",
})

const steps = [
  {
    title: "Describe your business",
    description:
      "Tell us what you do and where you operate. Choose the activities that fit your business.",
  },
  {
    title: "Follow your roadmap",
    description:
      "See the requirements that may apply, what comes next, and where to find official guidance.",
  },
  {
    title: "Keep track of progress",
    description:
      "Update your checklist as you go, revisit your saved details, and see what still needs attention.",
  },
] as const

export default function Page() {
  return (
    <div className="min-h-svh bg-background">
      <div className="bg-linear-to-b from-sky via-sky/35 to-background">
        <header className="h-24">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 sm:px-10">
            <Brand />
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "text-muted-foreground"
              )}
            >
              Open my roadmap
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </header>

        <main id="main-content">
          <section
            aria-labelledby="hero-title"
            className="flex min-h-[calc(100svh-6rem)] flex-col"
          >
            <div className="relative mx-auto flex min-h-120 w-full max-w-6xl flex-1 items-center justify-center px-6 py-14 sm:px-10 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hidden lg:block"
              >
                <Image
                  src="/brand/checklist.png"
                  alt=""
                  width={101}
                  height={122}
                  className="absolute top-10 left-12 h-[121px] w-25 rotate-[7.94deg] object-cover"
                />
                <Image
                  src="/brand/calendar.png"
                  alt=""
                  width={191}
                  height={231}
                  className="absolute bottom-10 left-0 h-[213px] w-44 -scale-y-100 rotate-[170.43deg] object-cover"
                />
                <Image
                  src="/brand/folder.png"
                  alt=""
                  width={194}
                  height={235}
                  className="absolute top-24 right-0 h-[218px] w-45 rotate-[9.48deg] object-cover"
                />
              </div>

              <div className="relative z-10 flex w-full max-w-205 flex-col items-center text-center">
                <h1
                  id="hero-title"
                  className="text-[clamp(2.5rem,5vw,4rem)] leading-[0.8] font-medium tracking-[-0.060em] text-balance"
                >
                  Business compliance
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>
                  one <span className="text-brand">clear step</span>{" "}
                  <span
                    className={cn(
                      melodrame.className,
                      "ml-2 inline-block text-[1.09375em] leading-none font-normal tracking-[-0.02em] whitespace-nowrap"
                    )}
                  >
                    at a time
                  </span>
                </h1>
                <p className="mt-3 max-w-155 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
                  Find the requirements relevant to your business, understand
                  what comes next, and track your progress in one place.
                </p>
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "ink" }),
                    "mt-8 h-12 gap-2.5 px-6 text-sm"
                  )}
                >
                  <Image src="/brand/store.svg" alt="" width={36} height={36} />
                  Build my roadmap
                </Link>
                <p className="mt-3 text-xs text-muted-foreground">
                  Free and easy to use
                </p>
              </div>
            </div>
            <AgencyStrip />
          </section>

          <section
            id="how-it-works"
            aria-labelledby="how-title"
            className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28"
          >
            <h2
              id="how-title"
              className="text-center text-3xl font-medium tracking-[-0.045em] sm:text-5xl"
            >
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-md text-center text-base leading-relaxed text-muted-foreground">
              From a few simple details to a clearer next step.
            </p>

            <ol className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-14 lg:gap-10">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
                >
                  <div
                    aria-hidden="true"
                    className="relative flex h-48 items-center justify-center overflow-hidden bg-linear-to-b from-brand/80 to-sky"
                  >
                    <HowItWorksPreview step={index} />
                  </div>
                  <div className="px-6 pt-6 pb-7">
                    <p className="text-xs font-semibold tracking-widest text-brand">
                      0{index + 1}
                    </p>
                    <h3 className="mt-2 text-xl font-medium tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </main>
      </div>

      <LandingContent />

      <footer className="mx-auto max-w-6xl border-t border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <Brand />
              <p className="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
                A clearer path for businesses in the City of Manila. Source-linked
                guidance with visible coverage limits; always confirm
                requirements with the issuing office.
              </p>
            </div>
            <nav
              aria-label="Footer"
              className="flex flex-wrap items-center gap-5 text-sm"
            >
              <Link
                href="/register"
                className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Build my roadmap
              </Link>
              <Link
                href="/dashboard"
                className="rounded-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open my roadmap
              </Link>
            </nav>
          </div>
          <p className="mt-7 text-xs text-muted-foreground">
            Made for small businesses. Built for one clear step at a time.
          </p>
        </div>
      </footer>
    </div>
  )
}
