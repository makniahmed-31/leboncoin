import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DARK_CLASS, THEME_STORAGE_KEY } from '@/shared/theme/theme'
import { ThemeToggle } from '@/shared/ui/theme-toggle'

describe('ThemeToggle', () => {
  /**
   * jsdom answers prefers-color-scheme with "no match", so "system" resolves to light here and
   * the class stays off. That is the assertion: system is the value in the store, and the class
   * reflects what it resolved to — not a third state.
   */
  it('starts on the system theme, which resolves to the light palette', () => {
    render(<ThemeToggle />)

    expect(screen.getByRole('radio', { name: 'Systeme' })).toBeChecked()
    expect(document.documentElement).not.toHaveClass(DARK_CLASS)
  })

  it('applies a chosen theme to the document and remembers it', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('radio', { name: 'Sombre' }))

    expect(document.documentElement).toHaveClass(DARK_CLASS)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked()
  })

  /**
   * Going back to "system" has to clear the stored value, not store the string "system". A
   * leftover key is a theme that looks right until the reader changes their OS setting and
   * nothing follows — and under the class strategy nothing in CSS would catch it, because the
   * class is only ever written from the stored value.
   */
  it('clears the override when the system theme is chosen again', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('radio', { name: 'Clair' }))
    await user.click(screen.getByRole('radio', { name: 'Systeme' }))

    expect(document.documentElement).not.toHaveClass(DARK_CLASS)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('reads the stored choice on mount, so a reload does not undo it', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(<ThemeToggle />)

    expect(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked()
  })

  /** The group is a single tab stop with arrow keys inside it, which is the point of using radios. */
  it('moves between themes with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.tab()
    expect(screen.getByRole('radio', { name: 'Systeme' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Clair' })).toBeChecked()
    expect(document.documentElement).not.toHaveClass(DARK_CLASS)
  })
})
