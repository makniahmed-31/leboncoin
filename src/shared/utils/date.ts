const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

/** Fixtures store unix seconds; the swagger claims a string. The data wins. */
export const toDate = (unixSeconds: number) => new Date(unixSeconds * 1000)

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const fullFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
const relativeFormatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

export function formatAbsolute(unixSeconds: number) {
  return fullFormatter.format(toDate(unixSeconds))
}

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()

export function formatDayLabel(unixSeconds: number, now = Date.now()) {
  const date = toDate(unixSeconds)
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86_400_000)

  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return relativeFormatter.format(-days, 'day')
  return dayFormatter.format(date)
}

export function formatTime(unixSeconds: number) {
  return timeFormatter.format(toDate(unixSeconds))
}

/** Compact stamp for the conversation list: a time today, a weekday this week, a date beyond. */
export function formatListStamp(unixSeconds: number, now = Date.now()) {
  const elapsed = Math.round(now / 1000) - unixSeconds
  if (elapsed < 60) return "a l'instant"

  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (elapsed >= seconds) {
      if (unit === 'day' && elapsed < 60 * 60 * 24 * 7) {
        return relativeFormatter.format(-Math.floor(elapsed / seconds), unit)
      }
      if (unit === 'day' || unit === 'month' || unit === 'year') {
        return dayFormatter.format(toDate(unixSeconds))
      }
      return relativeFormatter.format(-Math.floor(elapsed / seconds), unit)
    }
  }

  return relativeFormatter.format(-elapsed, 'second')
}

/**
 * How long ago a member was last connected, phrased for a presence line.
 *
 * Reuses the relative formatter rather than `formatListStamp`, because the two answer different
 * questions: a message from three weeks ago is best given as a date, while "Actif le 12 mars"
 * is a sentence nobody needs — past a few days, the useful answer is simply that they have not
 * been around.
 */
export function formatLastSeen(unixSeconds: number, now = Date.now()) {
  const elapsed = Math.round(now / 1000) - unixSeconds

  if (elapsed < 60) return "a l'instant"
  if (elapsed >= 60 * 60 * 24 * 7) return 'il y a longtemps'

  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (elapsed >= seconds) return relativeFormatter.format(-Math.floor(elapsed / seconds), unit)
  }

  return "a l'instant"
}
