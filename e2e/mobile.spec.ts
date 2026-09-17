import { expect, test } from '@playwright/test'

/**
 * The two panes are separate routes precisely so the phone's back gesture works without any
 * interception, which is what these assert.
 */
test.describe('mobile navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'runs on the mobile project only')

  test('the list fills the screen and the thread replaces it', async ({ page }) => {
    await page.goto('/conversations')

    const list = page.getByRole('list', { name: 'Liste des conversations' })
    await expect(list).toBeVisible()

    await list.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/conversations\/\d+/)

    // Replaced, not merely hidden behind: the list is out of the accessibility tree entirely.
    await expect(list).toBeHidden()
    await expect(page.getByRole('textbox', { name: /^Message a / })).toBeVisible()
  })

  test('the browser back button returns to the list', async ({ page }) => {
    await page.goto('/conversations')
    await page
      .getByRole('list', { name: 'Liste des conversations' })
      .getByRole('link')
      .first()
      .click()
    await expect(page).toHaveURL(/\/conversations\/\d+/)

    await page.goBack()

    await expect(page).toHaveURL(/\/conversations$/)
    await expect(page.getByRole('list', { name: 'Liste des conversations' })).toBeVisible()
  })

  test('the in-app back control returns to the list from a deep link', async ({ page }) => {
    // Straight to a thread, with no history behind it: history.back() would have nowhere to go.
    await page.goto('/conversations/4')

    await page.getByRole('link', { name: 'Retour a la liste des conversations' }).click()

    await expect(page).toHaveURL(/\/conversations$/)
    await expect(page.getByRole('list', { name: 'Liste des conversations' })).toBeVisible()
  })

  test('nothing overflows horizontally at phone width', async ({ page }) => {
    await page.goto('/conversations/4')
    await expect(page.getByRole('list', { name: /^Messages avec / })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflow).toBe(false)
  })
})
