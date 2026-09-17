import * as z from 'zod/mini'

/**
 * Whether a member currently holds an open event stream.
 *
 * Presence is derived from the live connection rather than stored on the user row, and that is
 * the whole design: there is no "online" column to go stale, no logout path that has to remember
 * to clear it, and a replica that dies takes its members' presence with it when their entries
 * expire. The cost is that presence is only ever as good as the last heartbeat, which is why the
 * window is generous enough to survive one missed beat.
 *
 * `online` is the answer to "should the dot be green", and nothing more. It deliberately does not
 * say *where* the member is — a member reading a different thread is online, and pretending to
 * know they are looking at this one would be an assertion the connection cannot support.
 */
export const presenceSchema = z.object({
  userId: z.coerce.number().check(z.int(), z.positive()),
  online: z.boolean(),
  /**
   * Unix seconds of the moment their last connection closed. Absent for a member who is online
   * now, and absent for one who has not been seen since the last Redis restart — presence is
   * ephemeral by construction, so "unknown" is a real answer rather than a gap to paper over.
   */
  lastSeenAt: z.optional(z.coerce.number().check(z.int(), z.gte(0))),
})

export const presenceListSchema = z.array(presenceSchema)

export type Presence = z.infer<typeof presenceSchema>

/** The body of a typing ping. `false` is sent on send and on blur, so the dots stop at once. */
export const typingInputSchema = z.object({
  typing: z.boolean(),
})

export type TypingInput = z.infer<typeof typingInputSchema>
