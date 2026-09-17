import { cn } from '@/lib/utils'

/**
 * The online indicator, drawn as a ring-cut dot on the corner of an avatar.
 *
 * The ring is the same colour as whatever sits behind it rather than a border, so the dot reads
 * as punched out of the avatar instead of stuck on top of it — which is what keeps it legible
 * against the six identity colours the avatar may be wearing underneath.
 *
 * Colour is never the only carrier. The dot is `aria-hidden` and every place that renders it also
 * renders the state in words, because a green circle and a grey circle are the same circle to a
 * red-green colourblind reader and nothing at all to a screen reader.
 */
export function PresenceDot({
  online,
  className,
  ringClassName = 'ring-card',
}: {
  online: boolean
  className?: string
  /** The colour the dot is punched out of; whatever the surface behind the avatar is. */
  ringClassName?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block size-3 rounded-full ring-2',
        online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        ringClassName,
        className
      )}
    />
  )
}

/**
 * Avatar with the dot positioned on it.
 *
 * A wrapper rather than a prop on `UserAvatar`, so the avatar stays a component about faces. The
 * two are composed at every call site that needs both, and the one that does not — the contacts
 * picker, where presence is noise — is unaffected.
 */
export function AvatarWithPresence({
  online,
  children,
  ringClassName,
  dotClassName,
}: {
  online: boolean
  children: React.ReactNode
  ringClassName?: string
  dotClassName?: string
}) {
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      <PresenceDot
        online={online}
        ringClassName={ringClassName}
        className={cn('absolute right-0 bottom-0', dotClassName)}
      />
    </span>
  )
}
