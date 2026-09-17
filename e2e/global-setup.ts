import { mkdirSync } from 'node:fs'

import { request } from '@playwright/test'

const WEB_PORT = 3100
const STATE_PATH = '.e2e/state.json'

/**
 * Signs in once, through the real login endpoint.
 *
 * Forging a cookie would be faster and would quietly stop testing that the two services agree on
 * how a token is signed and read — which is exactly the kind of thing that breaks when a secret or
 * an issuer changes and no unit test notices.
 *
 * The API is a separate deployment, so this checks it is reachable and says so plainly rather than
 * letting forty specs fail on a timeout with no explanation.
 */
export default async function globalSetup() {
  const context = await request.newContext({ baseURL: `http://localhost:${WEB_PORT}` })

  const health = await context.get('/api/health').catch(() => null)
  const reachable = health?.ok() === true && (await health.json()).api === 'up'

  if (!reachable) {
    await context.dispose()
    throw new Error(
      'The messaging API is not reachable.\n\n' +
        '  cd ../leboncoin-api && docker compose up -d && pnpm db:seed\n\n' +
        'Then run the suite again. Set API_URL if it is not on http://localhost:3005/api.'
    )
  }

  const response = await context.post('/api/auth/login', { data: { nickname: 'Thibaut' } })

  if (!response.ok()) {
    await context.dispose()
    throw new Error(
      `Could not sign in for the e2e run: ${response.status()} ${await response.text()}\n` +
        'Has the API been seeded, and does AUTH_SECRET match the one it was started with?'
    )
  }

  mkdirSync('.e2e', { recursive: true })
  await context.storageState({ path: STATE_PATH })
  await context.dispose()
}
