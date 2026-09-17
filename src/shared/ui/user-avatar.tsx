import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * The colours are per-user rather than a single neutral fallback, so the same person keeps the
 * same colour across the list and the thread. They are deliberately outside the token palette:
 * these are identity colours, not theme colours, and a user who is teal in light mode should stay
 * teal in dark mode rather than tracking `muted`.
 *
 * Every pair carries white text and is dark enough to hold it at 4.5:1.
 */
const PALETTE = [
  'bg-[#b8490a] text-white',
  'bg-[#1663ab] text-white',
  'bg-[#29853a] text-white',
  'bg-[#8a309f] text-white',
  'bg-[#0b7688] text-white',
  'bg-[#c72b2b] text-white',
]

/**
 * Listed rather than generated from a range, because the set is not a range: there is no
 * Avatar02. A missing file would otherwise become a silent 404 that degrades to initials, which
 * is exactly the failure this list makes loud.
 */
const AVATARS = [
  'Avatar01',
  'Avatar03',
  'Avatar04',
  'Avatar05',
  'Avatar06',
  'Avatar07',
  'Avatar08',
  'Avatar09',
  'Avatar10',
  'Avatar11',
  'Avatar12',
  'Avatar13',
  'Avatar14',
  'Avatar15',
  'Avatar16',
  'Avatar17',
  'Avatar18',
  'Avatar19',
  'Avatar20',
  'Avatar21',
]

/**
 * Derived from the id rather than read off the user record, because the row being rendered has no
 * URL on it. The conversation projection carries the two id/nickname pairs and nothing else —
 * `counterpartOf` hands back `{id, nickname}` — so attaching a real avatar in the list would cost
 * a second read per row, which is the fan-out the denormalised preview line exists to avoid.
 *
 * `userSchema` does expose an optional `avatarUrl`, and the contacts picker could honour it. It
 * deliberately does not: the same person has to wear the same face in the picker, the list and the
 * thread header, and one deterministic rule everywhere beats a real URL in the one place that has
 * one and a different-looking fallback in the two that do not. When the projection carries the URL
 * too, this becomes `user.avatarUrl` and the modulo goes away.
 *
 * Stable for a given id, so the same person keeps the same face in the list, the thread header
 * and the new-conversation picker.
 */
function avatarSrc(userId: number): string {
  return `/avatars/${AVATARS[userId % AVATARS.length]}.svg`
}

/**
 * Wraps shadcn's Avatar rather than editing it, so `npx shadcn add avatar --overwrite` stays a
 * safe thing to run: everything specific to this app lives here, and avatar.tsx remains whatever
 * the registry last produced.
 *
 * Purely decorative — the nickname is always rendered as text next to it, so this is hidden from
 * assistive technology rather than described.
 */
export function UserAvatar({
  nickname,
  userId,
  className,
}: {
  nickname: string
  userId: number
  className?: string
}) {
  const initials = nickname.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <Avatar aria-hidden="true" className={cn('size-11', className)}>
      {/* An <img> rather than the SVG inlined. These files carry their own <clipPath id>, and ids
          in an inlined SVG are document-global: twenty of them on one screen would collide and
          every avatar after the first would clip against the wrong path. An external image gets
          its own document and its own id scope. */}
      <AvatarImage alt="" loading="lazy" decoding="async" src={avatarSrc(userId)} />

      {/* Still the coloured initials, now as the degraded path rather than the only one: Radix
          renders this while the image loads and keeps it if the image fails, so a dead asset or an
          offline reload costs the face and not the row.

          Hidden again here, not just on the root: shadcn's Avatar is two nested spans where the
          old one was a single element, and an aria-hidden ancestor does not stop this inner span
          from being matched by DOM queries that skip decorative content. */}
      <AvatarFallback
        aria-hidden="true"
        className={cn('font-semibold select-none', PALETTE[userId % PALETTE.length])}
        delayMs={400}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
