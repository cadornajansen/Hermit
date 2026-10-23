import Link from "next/link"
import type { ReactElement } from "react"

export function PublicNav({
  current,
}: {
  current: "/" | "/about" | "/prototype"
}): ReactElement {
  const itemClass =
    "inline-flex min-h-11 items-center rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-white/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:px-4 sm:text-sm"
  return (
    <nav
      aria-label="Public pages"
      className="flex shrink-0 items-center rounded-full border border-white/80 bg-white/40 p-0.5 shadow-sm"
    >
      {[
        ["/about", "About"],
        ["/prototype", "Prototype"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={`${itemClass} aria-[current=page]:bg-white aria-[current=page]:text-foreground`}
        >
          {label}
        </Link>
      ))}
      <a href="https://github.com/cadornajansen/Hermit" className={itemClass}>
        GitHub<span className="sr-only"> repository</span>
      </a>
    </nav>
  )
}
