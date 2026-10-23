"use client"

import { Download, MessageCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { FORMS_LIBRARY, LIBRARY_AGENCIES, libraryUrl, searchLibrary } from "@/lib/forms-library"
import { cn } from "@/lib/utils"

// Every business-related government form HERMIT keeps a copy of, searchable
// by name or agency, each one a click away as a PDF.
export function FormsLibrary({ query }: { query: string }) {
  const [agency, setAgency] = useState<string>()
  const [shown, setShown] = useState(30)
  if (!FORMS_LIBRARY.length) return null
  const results = query.trim() ? searchLibrary(query, agency, 500) : FORMS_LIBRARY.filter((f) => !agency || f.agency === agency)

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">All official forms · {FORMS_LIBRARY.length}</h2>
        <p className="text-xs text-muted-foreground">
          Blank government forms for running a business, stored in HERMIT. Search above or pick an agency.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[undefined, ...LIBRARY_AGENCIES].map((a) => (
          <button
            key={a ?? "all"}
            onClick={() => {
              setAgency(a)
              setShown(30)
            }}
            className={cn("rounded-full border px-3 py-1 text-xs", agency === a ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted")}
          >
            {a ?? "All"}
          </button>
        ))}
      </div>
      {results.length === 0 && <p className="text-sm text-muted-foreground">No forms match.</p>}
      <ul className="flex flex-col divide-y rounded-2xl border bg-background text-sm">
        {results.slice(0, shown).map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 p-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{f.title}</span>
              <span className="text-xs text-muted-foreground">
                {f.agency}
                {f.pages ? ` · ${f.pages} page${f.pages === 1 ? "" : "s"}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <Link
                href={`/assistant?q=${encodeURIComponent(`Tulungan mo akong punan ang ${f.title} (${f.agency})`)}`}
                className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
                aria-label={`Ask Kuya Hermit about ${f.title}`}
              >
                <MessageCircle />
              </Link>
              <a href={libraryUrl(f.path)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "icon-sm", variant: "outline" })} aria-label={`Open ${f.title} PDF`}>
                <Download />
              </a>
            </span>
          </li>
        ))}
      </ul>
      {results.length > shown && (
        <button onClick={() => setShown((n) => n + 50)} className="self-start text-sm text-primary">
          Show more ({results.length - shown})
        </button>
      )}
    </section>
  )
}
