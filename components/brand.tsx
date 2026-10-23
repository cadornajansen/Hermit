import Image from "next/image"
import Link from "next/link"
import type { ReactElement } from "react"

import { cn } from "@/lib/utils"

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }): ReactElement {
  return (
    <Link
      href="/"
      aria-label="Hermit home"
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm text-lg font-medium tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-xl",
        className
      )}
    >
      <span
        className="block size-8 shrink-0"
        aria-hidden="true"
      >
        <Image
          src="/brand/hermit-logo.svg"
          alt=""
          width={36}
          height={36}
          className="size-full"
        />
      </span>
      {!compact && "Hermit"}
    </Link>
  )
}

export function PaperworkDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-[695px] max-w-[1470px] overflow-hidden lg:block"
    >
      <Image
        src="/brand/checklist.png"
        alt=""
        width={101}
        height={122}
        className="absolute top-36 left-[16%] h-[122px] w-[101px] rotate-[7.94deg] object-cover"
      />
      <Image
        src="/brand/calendar.png"
        alt=""
        width={191}
        height={231}
        className="absolute top-[380px] left-[8%] h-[231px] w-[191px] -scale-y-100 rotate-[170.43deg] object-cover"
      />
      <Image
        src="/brand/folder.png"
        alt=""
        width={194}
        height={235}
        className="absolute top-[220px] right-[8%] h-[235px] w-[194px] rotate-[9.48deg] object-cover"
      />
    </div>
  )
}
