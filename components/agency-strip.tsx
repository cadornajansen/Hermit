import Image from "next/image"

const agencies = [
  {
    name: "Department of Trade and Industry (DTI)",
    file: "dti",
    width: 137,
    height: 128,
  },
  {
    name: "Bureau of Internal Revenue (BIR)",
    file: "bir",
    width: 1250,
    height: 226,
  },
  {
    name: "Securities and Exchange Commission (SEC)",
    file: "sec",
    width: 367,
    height: 238,
  },
  {
    name: "Cooperative Development Authority (CDA)",
    file: "cda",
    width: 2246,
    height: 2246,
  },
] as const

export function AgencyStrip() {
  return (
    <section
      aria-labelledby="agency-strip-title"
      className="mx-auto w-full max-w-6xl shrink-0 px-6 pt-6 pb-10 sm:px-10"
    >
      <div className="flex flex-col items-center gap-6 md:flex-row md:gap-10">
        <p
          id="agency-strip-title"
          className="text-center text-sm leading-relaxed text-muted-foreground md:w-44 md:shrink-0 md:border-r md:border-border md:py-2 md:pr-6 md:text-left"
        >
          Government offices in your roadmap
        </p>
        <ul className="grid w-full grid-cols-2 items-center gap-x-6 gap-y-5 md:flex md:flex-1 md:flex-wrap md:justify-between md:gap-x-4">
          {agencies.map((agency) => (
            <li
              key={agency.file}
              className="flex h-14 min-w-0 items-center justify-center md:w-36"
            >
              <Image
                src={`/brand/agencies/${agency.file}.png`}
                alt={agency.name}
                width={agency.width}
                height={agency.height}
                className="max-h-12 w-auto max-w-full object-contain"
                sizes="144px"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
