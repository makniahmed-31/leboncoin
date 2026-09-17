import { apiPostVoid } from '@/lib/api-client'

/**
 * Fire-and-forget, and the rejection is swallowed at the call site rather than here.
 *
 * A typing ping that fails is not a failure the member should ever learn about: they are in the
 * middle of writing a sentence, and an error toast about an indicator would interrupt the one
 * thing the indicator exists to support. The consequence of a lost ping is three dots that do not
 * appear, which the recipient cannot distinguish from nobody typing.
 */
export function signalTypingRequest(conversationId: number, typing: boolean) {
  return apiPostVoid(`/conversations/${conversationId}/typing`, { typing })
}
