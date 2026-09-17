import { expect, test } from '@playwright/test'

const CONVERSATION = 4

test.describe('when things go wrong', () => {
  test('keeps a failed message with a retry, then sends it', async ({ page }) => {
    await page.goto(`/conversations/${CONVERSATION}`)
    // Scoped to the thread throughout: the same text also becomes the conversation's preview line
    // in the list once the send lands, and an unscoped lookup would match both.
    const thread = page.getByRole('list', { name: /^Messages avec / })
    await expect(thread).toBeVisible()

    // Fail only the send, so the thread around it stays healthy and the failure is visibly local.
    let failing = true
    await page.route('**/api/conversations/*/messages', async (route) => {
      if (route.request().method() === 'POST' && failing) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 503,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service indisponible.',
          }),
        })
        return
      }
      await route.continue()
    })

    const body = `Message resilient ${Date.now()}`
    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill(body)
    await composer.press('Enter')

    // A failed send is not surfaced immediately: it is retried three times with backoff first,
    // so a transient blip heals without the user ever seeing it. Only after that budget is spent
    // does the message get marked as failed, which is why this waits longer than the default.
    await expect(page.getByRole('button', { name: /Reessayer/ })).toBeVisible({ timeout: 20_000 })
    await expect(thread.getByText(body)).toBeVisible()

    failing = false
    await page.getByRole('button', { name: /Reessayer/ }).click()

    await expect(page.getByRole('button', { name: /Reessayer/ })).toHaveCount(0)
    await page.reload()
    await expect(thread.getByText(body)).toBeVisible()
  })

  test('warns when the browser goes offline and queues what the user writes', async ({
    page,
    context,
  }) => {
    await page.goto(`/conversations/${CONVERSATION}`)
    const thread = page.getByRole('list', { name: /^Messages avec / })
    await expect(thread).toBeVisible()

    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    const banner = page.getByText(/Vous etes hors ligne/i)
    await expect(banner).toBeVisible()

    const body = `Message en attente ${Date.now()}`
    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill(body)
    await composer.press('Enter')

    // Parked, not failed: the user sees it waiting rather than an error they cannot act on.
    await expect(thread.getByText(body)).toBeVisible()

    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    await expect(banner).toHaveCount(0)
    await page.reload()
    await expect(thread.getByText(body)).toBeVisible()
  })
})
