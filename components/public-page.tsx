import Link from "next/link"
import { Children, type ReactElement, type ReactNode } from "react"

import { PublicBrand } from "@/components/public-brand"
import { PublicNav } from "@/components/public-nav"
import { LandingReveal } from "@/components/landing-reveal"
import motion from "@/components/public-motion.module.css"

export function PublicPage({
  current,
  eyebrow,
  title,
  intro,
  children,
}: {
  current: "/about" | "/prototype"
  eyebrow: string
  title: string
  intro: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="min-h-svh bg-background">
      <div className="bg-linear-to-b from-sky via-sky/35 to-background">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-6 py-6 sm:px-10">
          <PublicBrand />
          <PublicNav current={current} />
        </header>
        <div
          className={`${motion.entrance} mx-auto max-w-6xl px-6 pt-14 pb-16 sm:px-10 sm:pt-20`}
        >
          <p
            data-entrance=""
            className="text-xs font-semibold tracking-widest text-brand uppercase"
          >
            {eyebrow}
          </p>
          <h1
            data-entrance=""
            className="mt-5 max-w-3xl text-4xl leading-[1.05] font-medium tracking-[-0.05em] text-balance sm:text-6xl"
          >
            {title}
          </h1>
          <p
            data-entrance=""
            className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
          >
            {intro}
          </p>
        </div>
      </div>
      <main
        id="main-content"
        className="mx-auto max-w-6xl space-y-16 px-6 pb-20 sm:px-10"
      >
        {Children.map(children, (child) =>
          child ? <LandingReveal>{child}</LandingReveal> : null
        )}
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border/70 px-6 py-8 text-sm sm:px-10">
        <PublicBrand />
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            href="/register"
          >
            Try the prototype
          </Link>
          <a
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            href="https://github.com/cadornajansen/Hermit"
          >
            View on GitHub
          </a>
        </nav>
      </footer>
    </div>
  )
}
