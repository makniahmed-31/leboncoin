import { expect, test } from '@playwright/test'

/**
 * Runs against an instance of the same build whose every call to the API is made to fail.
 *
 * This is the degraded path as a user would actually meet it, rather than a mocked response: the
 * server-side render fails too, which is precisely the case `page.route` cannot reproduce. The
 * retry policy backs off before giving up, so these need a longer budget than the default.
 */
test.describe('when the backend is down', () => {
  test.setTimeout(90_000)
  const settles = { timeout: 30_000 }

  test('the application shell still renders instead of going blank', async ({ page }) => {
    await page.goto('/conversations')

    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Nouvelle conversation/ })).toBeVisible()
  })

  test('the conversation list says what is wrong and offers a retry', async ({ page }) => {
    await page.goto('/conversations')

    // Scoped by its retry button: Next renders its own empty role="alert" route announcer, which
    // a bare getByRole('alert') would find first.
    const alert = page
      .getByRole('alert')
      .filter({ has: page.getByRole('button', { name: 'Reessayer' }) })

    await expect(alert).toBeVisible(settles)
    await expect(alert).toContainText(/indisponible|injoignable|repondu/i)
  })

  test('a failing conversation does not blank the surrounding layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/conversations/4')

    // The segment error boundary replaces the thread pane only; the shell around it survives.
    await expect(page.getByText('Conversation indisponible')).toBeVisible(settles)
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reessayer' }).first()).toBeVisible()
  })

  test('nothing on the page is a raw stack trace or an empty screen', async ({ page }) => {
    await page.goto('/conversations')

    await expect(page.getByRole('button', { name: 'Reessayer' }).first()).toBeVisible(settles)

    const text = await page.evaluate(() => document.body.innerText)
    expect(text.length).toBeGreaterThan(20)
    expect(text).not.toMatch(/at \w+ \(|ApiError:|TypeError|undefined is not/)
  })
})
