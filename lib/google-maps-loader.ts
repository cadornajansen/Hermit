let pending: Promise<void> | null = null

// Shared loader: selection changes never create another script or billable map instance.
export function loadGoogleMaps(key: string, timeoutMs = 15_000): Promise<void> {
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve()
  if (pending) return pending
  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    const target = window as unknown as Record<string, unknown>
    const previousAuthFailure = target.gm_authFailure
    const clean = () => {
      clearTimeout(timeout)
      delete target.__hermitOfficeMapReady
      target.gm_authFailure = previousAuthFailure
    }
    const fail = () => {
      clean()
      script.remove()
      pending = null
      reject(new Error("Google Maps could not load."))
    }
    const timeout = setTimeout(fail, timeoutMs)
    target.__hermitOfficeMapReady = () => {
      if (typeof window.google?.maps?.importLibrary !== "function") return fail()
      clean()
      resolve()
    }
    target.gm_authFailure = fail
    const url = new URL("https://maps.googleapis.com/maps/api/js")
    url.search = new URLSearchParams({ key, v: "quarterly", loading: "async", callback: "__hermitOfficeMapReady" }).toString()
    script.src = url.toString()
    script.async = true
    script.onerror = fail
    document.head.appendChild(script)
  })
  return pending
}
