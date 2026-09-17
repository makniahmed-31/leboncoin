import { formatPrice, type Product } from '@/lib/contracts'

import { cn } from '@/lib/utils'

/**
 * The listing a conversation is about, in the two sizes the interface needs.
 *
 * A marketplace message is always about something, and showing what turns an inbox of names into
 * an inbox of subjects — it is how someone with four threads open tells them apart at a glance.
 *
 * The listing's initial stands in for a photograph rather than an `<img>` tag, and the schema
 * carries an `imageUrl` that nothing renders yet. That is deliberate: this corpus has no photos,
 * so an image branch would be code that has never once executed — and rendering remote seller
 * URLs properly means either allow-listing every host in `next.config` or accepting an
 * unoptimised tag, which is a decision to make when there are real images to make it about.
 *
 * The mark is hidden from assistive technology because the title sits next to it in text, and
 * announcing the same listing twice is worse than not announcing the decoration at all.
 */
export function ProductBadge({
  product,
  size = 'sm',
  className,
}: {
  product: Product
  size?: 'sm' | 'md'
  className?: string
}) {
  const dimension = size === 'md' ? 'h-9 w-9' : 'h-6 w-6'

  return (
    <span
      className={cn(
        'text-muted-foreground bg-muted/70 inline-flex max-w-full items-center gap-2 rounded-full py-0.5 pr-2.5 pl-0.5',
        size === 'md' ? 'text-[13px]' : 'text-xs',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          dimension,
          'bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold'
        )}
      >
        {product.title.charAt(0).toUpperCase()}
      </span>

      <span className="truncate">{product.title}</span>
      <span className="text-foreground shrink-0 font-semibold">{formatPrice(product)}</span>
    </span>
  )
}
