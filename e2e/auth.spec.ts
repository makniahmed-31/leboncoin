import { expect, test } from '@playwright/test'

/**
 * The session, end to end.
 *
 * These run without the stored session that every other spec starts from, which is the only way
 * to cover the part of the system that decides whether there is one.
 */
test.describe('signing in', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sends an anonymous visitor to the login screen', async ({ page }) => {
    await page.goto('/conversations')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Messagerie' })).toBeVisible()
  })

  test('refuses an unknown member without leaking whether the account exists', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Pseudo').fill('PersonneDuTout')
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByRole('alert')).toContainText(/invalides/i)
    await expect(page).toHaveURL(/\/login$/)
  })

  test('requires a pseudo before submitting', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByText('Indiquez votre pseudo.')).toBeVisible()
  })

  test('signs in and lands on the conversations', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Pseudo').fill('Thibaut')
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page).toHaveURL(/\/conversations$/)
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible()
  })

  test('keeps the session token out of reach of page scripts', async ({ page, context }) => {
    await page.goto('/login')
    await page.getByLabel('Pseudo').fill('Thibaut')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL(/\/conversations$/)

    // The security property the whole BFF arrangement exists for: an injected script must not be
    // able to read the credential.
    const readable = await page.evaluate(() => document.cookie)
    expect(readable).not.toContain('lbc_session')

    const stored = await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })
    )
    expect(stored).not.toMatch(/eyJ|lbc_session/)

    // It does exist — as an httpOnly cookie the browser will send and no script can see.
    const cookie = (await context.cookies()).find((entry) => entry.name === 'lbc_session')
    expect(cookie?.httpOnly).toBe(true)
  })
})

test.describe('signing out', () => {
  test('clears the session and returns to the login screen', async ({ page }) => {
    await page.goto('/conversations')

    await page.getByRole('button', { name: /Connecte en tant que/ }).click()

    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/conversations')
    await expect(page).toHaveURL(/\/login$/)
  })
})
