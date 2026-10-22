import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Document uploads go through a Server Action (10MB cap + multipart overhead).
    serverActions: { bodySizeLimit: "11mb" },
  },
}

export default nextConfig
