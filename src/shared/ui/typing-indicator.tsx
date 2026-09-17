import { cn } from '@/lib/utils'

/**
 * The three dots on their own.
 *
 * One keyframe applied to all three with staggered delays, which is the whole trick: a bespoke
 * keyframe per dot would be three times the CSS to express the same wave. The travel is
 * deliberately small — a dot that can be noticed from across the room competes with the messages
 * for attention, and it sits right beside them. The global reduced-motion rule flattens it for
 * anyone who has asked for that, and the information survives, because the words carry it.
 */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center gap-1', className)}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-current opacity-70 motion-safe:animate-[typing-bounce_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  )
}

/**
 * The dots as a bubble, sitting where the next message would appear.
 *
 * Placed in the thread rather than only in the header because that is where the eye already is
 * while waiting for a reply, and because it occupies the space the message is about to take — so
 * the arrival of the message replaces it instead of shifting the thread.
 */
export function TypingIndicator({ nickname, className }: { nickname: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 px-1 pb-2', className)}>
      <span className="bg-muted text-muted-foreground flex items-center rounded-[18px] px-3.5 py-2.5">
        <TypingDots />
      </span>

      {/*
        The sentence is shown, quietly, rather than left to the dots: three animated circles are a
        convention rather than a self-explanatory symbol, and the nickname answers "who" on a
        screen that may be showing several threads.

        `aria-live` is deliberately absent here. The header carries one for this conversation, and
        a second region announcing the same fact would say it twice — and announcing "X is typing"
        each time somebody pauses and resumes would talk over the messages themselves.
      */}
      <p className="text-muted-foreground text-xs">{nickname} ecrit...</p>
    </div>
  )
}
