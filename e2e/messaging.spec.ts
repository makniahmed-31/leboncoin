import { expect, test } from '@playwright/test'

/** A generated thread that the seed guarantees to hold thousands of messages. */
const BUSY_CONVERSATION = 4

test.describe('conversations', () => {
  test('lists conversations and opens one', async ({ page }) => {
    await page.goto('/conversations')

    const list = page.getByRole('list', { name: 'Liste des conversations' })
    await expect(list.getByRole('link').first()).toBeVisible()

    const first = list.getByRole('link').first()
    // The avatar is decorative and hidden from assistive technology, so skipping the aria-hidden
    // spans lands on the block holding the nickname and the timestamp.
    const summary = await first.locator('span:not([aria-hidden="true"])').first().innerText()
    const name = summary.split('\n')[0]!.trim()
    await first.click()

    await expect(page).toHaveURL(/\/conversations\/\d+/)
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(name)
  })

  test('sends a message and keeps it after a reload', async ({ page }) => {
    await page.goto(`/conversations/${BUSY_CONVERSATION}`)

    const body = `Message e2e ${Date.now()}`
    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill(body)
    await composer.press('Enter')

    // Scoped to the thread: once the send lands, the same text is also the conversation's preview
    // line in the list, so an unscoped lookup matches two elements and fails strict mode.
    const thread = page.getByRole('list', { name: /^Messages avec / })
    await expect(thread.getByText(body)).toBeVisible()
    await expect(page.getByText('Envoi...')).toHaveCount(0)

    // The real assertion: the write survived. The documented POST endpoint creates a row with no
    // conversationId, which looks identical on screen until the page is reloaded.
    await page.reload()
    await expect(thread.getByText(body)).toBeVisible()
  })

  /**
   * The preview is a column on the conversation, written inside the same transaction as the
   * message rather than derived per row at read time. That makes this a check of the whole
   * write path rather than of the row's markup: send a message, navigate away so nothing is
   * served from the client cache, and find it in the list.
   */
  test('shows the last message as the preview in the conversation list', async ({ page }) => {
    await page.goto(`/conversations/${BUSY_CONVERSATION}`)

    const body = `Apercu e2e ${Date.now()}`
    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill(body)
    await composer.press('Enter')

    await expect(page.getByRole('list', { name: /^Messages avec / }).getByText(body)).toBeVisible()

    await page.goto('/conversations')
    const list = page.getByRole('list', { name: 'Liste des conversations' })
    // A send moves its conversation to the top of the list, so the row carrying the preview is
    // the first one.
    await expect(list.getByRole('listitem').first()).toContainText(body)
  })

  test('the composer clears and keeps focus after sending', async ({ page }) => {
    await page.goto(`/conversations/${BUSY_CONVERSATION}`)

    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill('Message court')
    await composer.press('Enter')

    await expect(composer).toHaveValue('')
    await expect(composer).toBeFocused()
  })

  test('Shift+Enter writes a new line instead of sending', async ({ page }) => {
    await page.goto(`/conversations/${BUSY_CONVERSATION}`)

    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill('premiere ligne')
    await composer.press('Shift+Enter')
    await composer.type('seconde ligne')

    await expect(composer).toHaveValue('premiere ligne\nseconde ligne')
  })

  test('keeps a draft when the user leaves and comes back', async ({ page }) => {
    await page.goto(`/conversations/${BUSY_CONVERSATION}`)

    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill('brouillon a retrouver')

    await page.goto('/conversations')
    await page.goto(`/conversations/${BUSY_CONVERSATION}`)

    await expect(page.getByRole('textbox', { name: /^Message a / })).toHaveValue(
      'brouillon a retrouver'
    )
  })

  /**
   * A thread is read from its end, so opening one has to land on the newest message.
   *
   * Asserted in pixels rather than by looking for the last bubble, because the failure this
   * guards against is invisible to a content check: the view sits a screenful above the bottom
   * with the newest message in the DOM but off screen. The anchoring runs against the
   * virtualizer's measurements, which settle a frame or two after the rows mount, so it is worth
   * pinning even while it holds.
   *
   * Several conversations rather than one, opened both ways: the anchoring depends on how a
   * given thread's rows measure against the estimate, and on whether the scroll container is new
   * or re-used, so a single thread proves nothing. Note this runs against a production build —
   * the variant of this that had to be fixed only reproduced under the dev server's StrictMode
   * double-mount, which no Playwright project exercises.
   */
  test('opens every conversation on its newest message', async ({ page }) => {
    const distanceFromBottom = () =>
      page.evaluate(() => {
        const list = [...document.querySelectorAll('ol')].find((element) =>
          (element.getAttribute('aria-label') ?? '').startsWith('Messages avec')
        )
        const scroller = list?.parentElement
        if (!scroller) return null
        return Math.round(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight)
      })

    const settle = async () => {
      await expect(page.getByRole('list', { name: /^Messages avec / })).toBeVisible()
      // The anchor converges over a few measurement passes rather than in one commit.
      await expect.poll(distanceFromBottom, { timeout: 5_000 }).toBeLessThanOrEqual(4)
    }

    await page.goto('/conversations')
    const conversations = page.getByRole('list', { name: 'Liste des conversations' })
    await expect(conversations.getByRole('link').first()).toBeVisible()

    // Opened from the list. On desktop both panes are on screen, so this switches straight from
    // one thread to the next and re-uses the same scroll container — the case that stayed broken
    // after a direct load had been fixed. On mobile the thread replaces the list, so there is a
    // step back to it first and each thread gets a fresh container.
    for (const index of [0, 3, 1, 6, 2]) {
      if (!(await conversations.getByRole('link').first().isVisible())) {
        await page.goto('/conversations')
      }
      await conversations.getByRole('link').nth(index).click()
      await settle()
    }

    // And opened cold, where the thread is server-rendered and nothing is in the cache.
    for (const id of [BUSY_CONVERSATION, 32, 35]) {
      await page.goto(`/conversations/${id}`)
      await settle()
    }
  })

  test('scrolls back through a long thread without losing its place', async ({ page }) => {
    await page.goto(`/conversations/${BUSY_CONVERSATION}`)

    const list = page.getByRole('list', { name: /^Messages avec / })
    await expect(list.getByRole('listitem').first()).toBeVisible()

    const before = await list.getByRole('listitem').count()
    await page.mouse.move(400, 300)
    for (let step = 0; step < 6; step += 1) {
      await page.mouse.wheel(0, -1500)
      await page.waitForTimeout(150)
    }

    // More history is loaded, yet the DOM stays bounded: that is virtualization doing its job.
    await expect(list.getByRole('listitem').first()).toBeVisible()
    const after = await list.getByRole('listitem').count()
    expect(after).toBeLessThan(before + 60)

    // And the reader stays in the history they scrolled back to. The anchor that pulls a thread
    // to its newest message must let go the moment somebody scrolls up, or reading back through a
    // conversation is impossible: every measurement pass would drag them to the bottom again.
    const offset = () =>
      page.evaluate(() => {
        const element = [...document.querySelectorAll('ol')].find((node) =>
          (node.getAttribute('aria-label') ?? '').startsWith('Messages avec')
        )?.parentElement
        return element ? Math.round(element.scrollTop) : null
      })

    const parked = await offset()
    expect(parked).toBeGreaterThan(0)
    await page.waitForTimeout(1_500)
    expect(Math.abs((await offset())! - parked!)).toBeLessThan(80)
  })

  test('lists conversations from the most recent down', async ({ page }) => {
    await page.goto('/conversations')

    const stamps = await page
      .locator('[aria-label="Liste des conversations"] time[datetime]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''))

    expect(stamps.length).toBeGreaterThan(1)
    expect(stamps).toEqual(stamps.toSorted().toReversed())
  })

  test('a conversation moves to the top when it receives a message, and stays there', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/conversations')

    const list = page.locator('[aria-label="Liste des conversations"]')
    await expect(list.getByRole('link').first()).toBeVisible()

    // Deliberately not the first row: a conversation already at the top would pass without the
    // list ever reordering.
    const target = await list.getByRole('link').nth(5).getAttribute('href')
    await list.getByRole('link').nth(5).click()
    await expect(page).toHaveURL(target!)

    const composer = page.getByRole('textbox', { name: /^Message a / })
    await composer.fill(`Tri de la liste ${Date.now()}`)
    await composer.press('Enter')

    // The rendered order comes from the order of the cached items, so writing a fresh timestamp
    // into the row is not enough on its own to move it.
    await expect(list.getByRole('link').first()).toHaveAttribute('href', target!)

    // And it has to survive a reload, which is served by the page render rather than by the
    // route handler the browser just talked to.
    await page.reload()
    await expect(list.getByRole('link').first()).toHaveAttribute('href', target!)
  })

  test('starts a new conversation', async ({ page }) => {
    await page.goto('/conversations')

    await page
      .getByRole('button', { name: /Nouvelle conversation/ })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Rechercher un membre').fill('yasmine')
    await dialog.getByRole('button').filter({ hasText: 'Yasmine' }).click()

    await expect(page).toHaveURL(/\/conversations\/\d+/)
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Yasmine')
  })

  test('shows a 404 page for a conversation the user is not part of', async ({ page }) => {
    // Seeded to involve two other members, so it must not be reachable.
    await page.goto('/conversations/9')
    await expect(page.getByText('Conversation introuvable')).toBeVisible()
  })
})
