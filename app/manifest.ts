import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HERMIT — Your business, remembered",
    short_name: "HERMIT",
    description: "One compliance checklist for Philippine MSME owners.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  }
}
