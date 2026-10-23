import Image from "next/image"
import Link from "next/link"
import type { ReactElement } from "react"

export function PublicBrand(): ReactElement {
  return (
    <Link
      href="/"
      aria-label="Hermit home"
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm text-lg font-medium tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-xl"
    >
      <Image
        src="/brand/hermit-logo.svg"
        alt=""
        width={36}
        height={36}
        className="size-8 sm:size-9"
      />
      Hermit
    </Link>
  )
}
