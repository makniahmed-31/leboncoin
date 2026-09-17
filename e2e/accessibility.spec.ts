import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const CONVERSATION = 4

test.describe('accessibility', () => {
  /**
   * Both colour schemes, because both are reachable and only one of them is ever on screen while
   * a person reviews the work. The dark palette shipped once applying to every user by mistake,
   * and its contrast was never checked until a screenshot gave it away.
   */
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${colorScheme} theme`, () => {
      test.use({ colorScheme })

      test('the conversation list has no detectable violations', async ({ page }) => {
        await page.goto('/conversations')
        await expect(page.getByRole('list', { name: 'Liste des conversations' })).toBeVisible()

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()

        expect(results.violations).toEqual([])
      })

      test('an open conversation has no detectable violations', async ({ page }) => {
        await page.goto(`/conversations/${CONVERSATION}`)
        await expect(page.getByRole('list', { name: /^Messages avec / })).toBeVisible()

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()

        expect(results.violations).toEqual([])
      })
    })
  }

  /**
   * The theme the reader picks, rather than the one the operating system asked for. It is a
   * different code path — an attribute on <html> instead of a media query — and it is the one
   * that carries the toggle itself, whose own contrast nothing else checks.
   */
  test('a theme chosen from the toggle has no detectable violations', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/conversations')
    await page.getByRole('radio', { name: 'Sombre' }).check()
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('the whole flow works from the keyboard alone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/conversations')
    await expect(page.getByRole('list', { name: 'Liste des conversations' })).toBeVisible()

    // Tab until a conversation link has focus, then open it with Enter.
    let opened = false
    for (let step = 0; step < 15 && !opened; step += 1) {
      await page.keyboard.press('Tab')
      const href = await page.evaluate(() => document.activeElement?.getAttribute('href'))
      if (href?.startsWith('/conversations/')) {
        await page.keyboard.press('Enter')
        opened = true
      }
    }
    expect(opened).toBe(true)
    await expect(page).toHaveURL(/\/conversations\/\d+/)

    // Then tab on to the composer and send without ever touching the mouse.
    const composer = page.getByRole('textbox', { name: /^Message a / })
    await expect(composer).toBeVisible()

    let focusedComposer = false
    for (let step = 0; step < 25 && !focusedComposer; step += 1) {
      await page.keyboard.press('Tab')
      focusedComposer = await composer.evaluate((node) => node === document.activeElement)
    }
    expect(focusedComposer).toBe(true)

    const body = `Message au clavier ${Date.now()}`
    await page.keyboard.type(body)
    await page.keyboard.press('Enter')
    await expect(page.getByText(body)).toBeVisible()
  })

  /*
   * Deliberately at each project's own viewport rather than a forced 1280.
   *
   * The link points at `#contenu`, and which pane carries that id depends on the breakpoint: below
   * md with no thread open the right-hand pane is `display:none`, and a skip link aimed into it
   * moves focus nowhere at all. Pinning the viewport wide hid exactly that case, on the width
   * where skipping past a long list matters most.
   */
  test('the skip link is reachable and moves focus to the content', async ({ page }) => {
    await page.goto('/conversations')

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Aller au contenu' })
    await expect(skip).toBeFocused()

    // Activating it is the half that was never asserted: a link can be perfectly focusable and
    // still land on nothing.
    await page.keyboard.press('Enter')
    await expect(page.locator('#contenu')).toBeFocused()
  })

  test('the new conversation dialog traps focus and restores it on close', async ({ page }) => {
    await page.goto('/conversations')
    const trigger = page.getByRole('button', { name: /Nouvelle conversation/ }).first()
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})
