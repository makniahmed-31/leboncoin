import { cn } from '@/lib/utils'

/**
 * Decorative: whatever is loading announces itself in text nearby, so a second announcement here
 * would only be noise.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className ?? 'h-4 w-4'
      )}
    />
  )
}
