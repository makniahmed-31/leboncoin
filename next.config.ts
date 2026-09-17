import bundleAnalyzer from '@next/bundle-analyzer'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /*
   * Traces the module graph and emits only what the server actually loads, plus a minimal
   * server.js — a few hundred files instead of the whole of node_modules in the image.
   *
   * Conditional, because `next start` refuses to serve a standalone build: it prints "next start
   * does not work with output: standalone" and does nothing. The e2e suite's web server runs
   * `next start`, and so does the CI job that drives it, so setting this unconditionally would
   * trade a working browser suite for a smaller image. The Dockerfile's build stage turns it on;
   * nothing else needs to.
   */
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
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
