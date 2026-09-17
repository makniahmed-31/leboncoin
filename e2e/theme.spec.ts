import { expect, type Page, test } from '@playwright/test'

const html = (page: Page) => page.locator('html')

/** The palette itself, not the class that selects it. */
function background(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

/**
 * Waits for the class to catch up with the OS setting before reading the palette.
 *
 * This wait is the class strategy showing through. When the theme was `color-scheme` the browser
 * repainted synchronously with the media change and a plain read was safe; now a JavaScript
 * listener has to rewrite the class first, so reading the background immediately after
 * emulateMedia races it.
 */
async function settle(page: Page, scheme: 'dark' | 'light') {
  await page.emulateMedia({ colorScheme: scheme })

  const root = html(page)
  if (scheme === 'dark') await expect(root).toHaveClass(/\bdark\b/)
  else await expect(root).not.toHaveClass(/\bdark\b/)

  return background(page)
}

/**
 * The two palettes are read from the page rather than written down here. The tokens are oklch and
 * the browser reports the computed value in whatever colour space it settles on, so a hardcoded
 * `rgb(...)` string tests Chrome's serialisation as much as it tests the theme. Sampling both
 * ends once and comparing against those keeps the assertion on the thing that matters: that the
 * palette actually changed.
 *
 * Only valid while the reader is on "system", which is the state every caller is in when it runs.
 */
async function palettes(page: Page) {
  const dark = await settle(page, 'dark')
  const light = await settle(page, 'light')

  expect(dark).not.toBe(light)
  return { dark, light }
}

/**
 * The parts of a theme switch that only a real browser can prove: that the choice survives a
 * reload without the other theme flashing first, that it beats the operating system setting, and
 * that the palette actually changed rather than only the class.
 */
test.describe('theme', () => {
  test('follows the system until a theme is chosen', async ({ page }) => {
    await page.goto('/conversations')
    const { dark, light } = await palettes(page)

    // An empty localStorage is how "system" is represented; the class on <html> is then whatever
    // the boot script resolved the media query to, which is why it is not asserted here.
    expect(await page.evaluate(() => localStorage.getItem('lbc-messaging-theme'))).toBeNull()

    expect(await settle(page, 'dark')).toBe(dark)
    expect(await settle(page, 'light')).toBe(light)
  })

  test('a chosen theme overrides the system setting', async ({ page }) => {
    await page.goto('/conversations')
    const { dark } = await palettes(page)

    await page.getByRole('radio', { name: 'Sombre' }).check()

    await expect(html(page)).toHaveClass(/\bdark\b/)
    expect(await background(page)).toBe(dark)

    // And it stays dark when the system says light, which is the whole point of the override.
    await page.emulateMedia({ colorScheme: 'light' })
    expect(await background(page)).toBe(dark)
  })

  /**
   * The flash test. The assertion is on the very first paint, not on the settled page: a theme
   * applied from an effect passes every "is it dark now" check and still shows a white screen for
   * a frame. Reading the class before any stylesheet or hydration has run is what catches it.
   */
  test('survives a reload without painting the other theme first', async ({ page }) => {
    await page.goto('/conversations')
    const { dark } = await palettes(page)

    await page.emulateMedia({ colorScheme: 'light' })
    await page.getByRole('radio', { name: 'Sombre' }).check()

    await page.reload({ waitUntil: 'commit' })
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      true
    )

    await expect(page.getByRole('radio', { name: 'Sombre' })).toBeChecked()
    expect(await background(page)).toBe(dark)
  })

  test('going back to the system theme forgets the choice', async ({ page }) => {
    await page.goto('/conversations')
    const { light } = await palettes(page)

    await page.emulateMedia({ colorScheme: 'light' })
    await page.getByRole('radio', { name: 'Sombre' }).check()
    await page.getByRole('radio', { name: 'Systeme' }).check()

    await page.reload()
    expect(await page.evaluate(() => localStorage.getItem('lbc-messaging-theme'))).toBeNull()
    await expect(html(page)).not.toHaveClass(/\bdark\b/)
    expect(await background(page)).toBe(light)
  })

  /**
   * The class strategy's own failure mode, which the old color-scheme one could not have: with
   * "system" chosen, nothing in CSS follows the OS, so the store has to rewrite the class itself
   * when the setting flips mid-session.
   */
  test('follows a system change made while the page is open', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/conversations')
    await expect(page.getByRole('radio', { name: 'Systeme' })).toBeChecked()
    await expect(html(page)).not.toHaveClass(/\bdark\b/)

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(html(page)).toHaveClass(/\bdark\b/)
  })
})
