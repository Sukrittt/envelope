import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint is deferred — see eslint.config.mjs. Next only type-checks during build.
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig