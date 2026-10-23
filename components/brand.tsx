import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Hermit home"
      className={cn(
        "inline-flex items-center gap-1.5 text-xl font-medium tracking-[-0.05em]",
        className
      )}
    >
      <span
        className="relative block size-8 overflow-hidden"
        aria-hidden="true"
      >
        <Image
          src="/brand/logo-sheet.png"
          alt=""
          width={1024}
          height={1024}
          className="absolute top-[-139.49%] left-[-15.84%] size-[378.26%] max-w-none"
        />
      </span>
      Hermit
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
