import type { Metadata } from "next"

export function publicMetadata(
  title: string,
  description: string,
  path: string
): Metadata {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL
  const origin = configuredUrl ? new URL(configuredUrl).origin : undefined
  const image = {
    url: `${origin ?? ""}/brand/hermit-social.png`,
    width: 1200,
    height: 630,
    alt: "Hermit — Business compliance, one clear step at a time",
  }
  return {
    title,
    description,
    ...(origin
      ? {
          metadataBase: new URL(origin),
          alternates: { canonical: `${origin}${path}` },
        }
      : {}),
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Hermit",
      locale: "en_PH",
      ...(origin ? { url: `${origin}${path}` } : {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}
