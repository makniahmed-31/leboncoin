import { describe, expect, it } from 'vitest'

import { formatDayLabel, formatTime } from './date'

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

describe('formatDayLabel', () => {
  const now = new Date('2026-09-15T14:00:00').getTime()

  it('labels today and yesterday in words', () => {
    expect(formatDayLabel(at('2026-09-15T09:00:00'), now)).toBe("Aujourd'hui")
    expect(formatDayLabel(at('2026-09-14T23:30:00'), now)).toBe('Hier')
  })

  it('treats the boundary by calendar day, not by elapsed hours', () => {
    // 23:30 yesterday is fifteen hours ago, which is under a day but still yesterday.
    expect(formatDayLabel(at('2026-09-14T23:30:00'), now)).toBe('Hier')
    expect(formatDayLabel(at('2026-09-15T00:10:00'), now)).toBe("Aujourd'hui")
  })

  it('falls back to a date beyond the last week', () => {
    expect(formatDayLabel(at('2026-08-02T10:00:00'), now)).toMatch(/2 ao/)
  })
})

describe('formatTime', () => {
  it('renders a 24-hour French time', () => {
    expect(formatTime(at('2026-09-15T14:45:00'))).toMatch(/14[:h]45/)
  })
})
