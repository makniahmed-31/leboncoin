import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end against the real interface and a real API.
 *
 * The API lives in its own repository, so this suite does not start it — it expects one running at
 * `API_URL` and fails with a clear message if there is not. Reaching across the filesystem to boot
 * a sibling checkout would work on the machine it was written on and nowhere else, and it would
 * quietly couple two repositories that are deployed independently.
 *
 *   cd ../leboncoin-api && docker compose up -d && pnpm db:seed
 *   npm run e2e
 */
const WEB_PORT = 3100
/** A second instance of the same build, wired so every call to the API fails. */
const OUTAGE_PORT = 3101

const apiUrl = process.env.API_URL ?? 'http://localhost:3005/api'

const webEnv = {
  NODE_ENV: 'production',
  API_URL: apiUrl,
  // Must match the API's, because the web tier verifies the session cookie's signature before
  // rendering a page as anybody.
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-secret-that-is-at-least-32-characters-long',
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Written by the global setup, which signs in once through the real endpoint. Every test then
    // starts authenticated without paying for a login, and the login flow itself is covered by
    // the one spec that clears this.
    storageState: '.e2e/state.json',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /outage\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testIgnore: /outage\.spec\.ts/,
    },
    {
      /**
       * A degraded backend cannot be produced with `page.route`: the pages fetch their first data
       * on the server, and the browser never sees that request at all. So it is tested against a
       * real instance whose calls to the API are made to fail, which is the honest version of the
       * scenario anyway.
       */
      name: 'outage',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${OUTAGE_PORT}` },
      testMatch: /outage\.spec\.ts/,
    },
  ],
  webServer: [
    {
      // Built, not dev: the dev server's overlays and recompiles make timing-sensitive assertions
      // flaky, and this is closer to what actually gets deployed.
      command: `npm run build && npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: webEnv,
    },
    {
      command: `npx next start --port ${OUTAGE_PORT}`,
      url: `http://localhost:${OUTAGE_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Every call to the API fails. This is the resilience switch, turned all the way up.
      env: { ...webEnv, CHAOS_RATE: '1' },
    },
  ],
})
