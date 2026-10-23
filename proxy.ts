import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()
  try {
    if (!["https:", "http:"].includes(new URL(url).protocol)) return NextResponse.next()
  } catch {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const client = createServerClient(url, key, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        for (const { name, value } of values) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options)
        for (const [name, value] of Object.entries(headers))
          response.headers.set(name, value)
      },
    },
  })
  // Persist refresh cookies before Server Components read the validated account.
  await client.auth.getUser()
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0"
  )
  return response
}

export const config = {
  matcher: [
    "/",
    "/register",
    "/onboarding",
    "/dashboard",
    "/roadmap",
    "/profile",
    "/calendar",
    "/vault",
    "/offices",
    "/assistant",
    "/forms/:path*",
    "/pay",
  ],
}
