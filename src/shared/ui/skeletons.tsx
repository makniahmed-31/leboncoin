import { Skeleton } from '@/shared/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * The composed placeholders, kept apart from skeleton.tsx so that file stays exactly what the
 * shadcn registry generates and can be regenerated without losing these.
 *
 * Widths come through `style` rather than Tailwind classes because they are data — a sequence the
 * components below index into — and an arbitrary-value class built from a variable is a string
 * Tailwind cannot see at build time, so it would never be generated.
 */

/**
 * The widths are varied on purpose, and they are a fixed sequence rather than random.
 *
 * Seven identical rows read as a loading graphic; rows of differing length read as text that has
 * not arrived yet, which is what is actually about to replace them. Randomising would reshuffle
 * on every render and, worse, differ between the server pass and the hydration pass.
 */
const ROW_WIDTHS = [
  ['60%', '35%'],
  ['45%', '28%'],
  ['68%', '30%'],
  ['52%', '22%'],
  ['40%', '32%'],
  ['64%', '26%'],
  ['50%', '24%'],
] as const

export const CONVERSATION_SKELETON_COUNT = ROW_WIDTHS.length

/**
 * Shaped like the real row rather than a generic bar, so the page does not visibly reflow when
 * the data lands. That now includes the preview line, which is the second bar.
 */
export function ConversationRowSkeleton({ index = 0 }: { index?: number }) {
  const [name, preview] = ROW_WIDTHS[index % ROW_WIDTHS.length]!

  return (
    <li className="flex items-center gap-3 rounded-[18px] px-3.5 py-2.5">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-[7px]">
        <Skeleton className="h-3 rounded-md" style={{ width: name }} />
        <Skeleton className="h-2.5 rounded-md" style={{ width: preview }} />
      </span>
    </li>
  )
}

/** Mirrors the thread header: avatar, name, and the muted line underneath it. */
export function ConversationHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-1 items-center gap-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <span className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-30 rounded-md" />
        <Skeleton className="h-2.5 w-20 rounded-md" />
      </span>
    </div>
  )
}

/**
 * Alternating sides and differing widths, for the same reason the list rows differ: a stack of
 * identical bubbles does not look like a conversation waiting to load.
 */
const MESSAGE_PLACEHOLDERS = [
  { id: 'pm0', align: 'start', width: '13.75rem' },
  { id: 'pm1', align: 'end', width: '10rem' },
  { id: 'pm2', align: 'start', width: '16.25rem' },
  { id: 'pm3', align: 'end', width: '11.875rem' },
  { id: 'pm4', align: 'start', width: '8.75rem' },
] as const

export function MessageSkeleton({ index = 0 }: { index?: number }) {
  const { align, width } = MESSAGE_PLACEHOLDERS[index % MESSAGE_PLACEHOLDERS.length]!

  return (
    <div className={cn('flex', align === 'end' ? 'justify-end' : 'justify-start')}>
      <Skeleton className="rounded-bubble h-[38px] max-w-[78%]" style={{ width }} />
    </div>
  )
}

/** The whole placeholder thread, so the two places that show one cannot drift apart. */
export function MessageThreadSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" aria-hidden="true">
      {MESSAGE_PLACEHOLDERS.map((placeholder, index) => (
        <MessageSkeleton key={placeholder.id} index={index} />
      ))}
    </div>
  )
}
