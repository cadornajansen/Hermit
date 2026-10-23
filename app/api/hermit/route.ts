import { askHermit } from "@/app/actions"

// Kuya Hermit, streamed: one JSON line per tool step as it runs, then the
// answer. Same checks as the askHermit action (owner, quota, guardrails).
export const maxDuration = 120

export async function POST(req: Request) {
  // Same-origin only: the owner cookie is SameSite=Lax, and this blocks
  // cross-site form posts that would otherwise spend the owner's quota.
  const origin = req.headers.get("origin")
  if (!origin || new URL(origin).host !== req.headers.get("host")) return new Response("Forbidden", { status: 403 })
  const input = await req.json().catch(() => null)
  if (!input) return new Response("Bad request", { status: 400 })

  const enc = new TextEncoder()
  const body = new ReadableStream({
    async start(c) {
      const send = (o: unknown) => c.enqueue(enc.encode(`${JSON.stringify(o)}\n`))
      try {
        const reply = await askHermit(input, (step) => send({ type: "step", step }))
        send({ type: "done", reply })
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "failed" })
      }
      c.close()
    },
  })
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } })
}
