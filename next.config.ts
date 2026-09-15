import bundleAnalyzer from '@next/bundle-analyzer'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next writes AGENTS.md and CLAUDE.md into the repo root on first run otherwise.
  agentRules: false,
  experimental: {
    optimizePackageImports: ['@tanstack/react-query', '@tanstack/react-virtual'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })(config)
