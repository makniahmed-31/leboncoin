import { HttpResponse, http } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/lib/contracts'

import type { Conversation } from '@/features/conversations/schemas'
import type { Message } from '@/features/messages/schemas'

import { CURRENT_USER_ID, makeConversation, makeMessage, makeProduct, makeUser } from './factories'

/**
 * A small in-memory stand-in for the BFF proxy.
 *
 * Tests exercise the client against the contract the route handlers pass through — the same page
 * envelope and the same error shape the API produces — rather than against a real backend. That
 * keeps them fast and lets a test choose a failure, such as a 500 on send or an empty page,
 * without arranging one on a running service.
 */
export const db = {
  conversations: [] as Conversation[],
  messages: [] as Message[],
  nextMessageId: 100,
}

export function seedTestDb({
  conversations = [makeConversation()],
  messages = [makeMessage()],
}: { conversations?: Conversation[]; messages?: Message[] } = {}) {
  db.conversations = conversations
  db.messages = messages
  db.nextMessageId = Math.max(0, ...messages.map((message) => message.id)) + 1
}

seedTestDb()

/**
 * Offset paging, deliberately, even though the API uses keyset cursors.
 *
 * The cursor is opaque to everything on this side, so a stub only has to produce a token that
 * round-trips — and an offset is the cheapest thing that does. Mirroring the real encoding here
 * would couple the tests to a server-side detail the client is specifically built not to know.
 */
function page<T>(items: T[], url: URL) {
  const cursor = Number(url.searchParams.get('cursor') ?? 0)
  const limit = Number(url.searchParams.get('limit') ?? 30)
  const slice = items.slice(cursor, cursor + limit)
  const next = cursor + slice.length
  const hasMore = next < items.length
  return { data: slice, nextCursor: hasMore ? String(next) : null, hasMore }
}

function apiError(status: number, code: ApiErrorCode, message: string) {
  return HttpResponse.json<ApiErrorBody>({ statusCode: status, code, message }, { status })
}

export const handlers = [
  http.get('/api/conversations', ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('q')?.trim().toLocaleLowerCase('fr')

    const matching = search
      ? db.conversations.filter((conversation) =>
          [conversation.senderNickname, conversation.recipientNickname, conversation.preview ?? '']
            .join(' ')
            .toLocaleLowerCase('fr')
            .includes(search)
        )
      : db.conversations

    const sorted = matching.toSorted(
      (a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp || b.id - a.id
    )

    return HttpResponse.json(page(sorted, url))
  }),

  http.get('/api/conversations/:conversationId', ({ params }) => {
    const conversation = db.conversations.find(
      ({ id }) => id === Number(params.conversationId as string)
    )
    return conversation
      ? HttpResponse.json(conversation)
      : apiError(404, 'CONVERSATION_NOT_FOUND', 'Introuvable.')
  }),

  http.get('/api/conversations/:conversationId/messages', ({ params, request }) => {
    const conversationId = Number(params.conversationId as string)
    const thread = db.messages
      .filter((message) => message.conversationId === conversationId)
      .toSorted((a, b) => b.timestamp - a.timestamp || b.id - a.id)
    return HttpResponse.json(page(thread, new URL(request.url)))
  }),

  http.post('/api/conversations/:conversationId/messages', async ({ params, request }) => {
    const body = (await request.json()) as { body: string; clientId: string }
    const message = makeMessage({
      id: db.nextMessageId++,
      conversationId: Number(params.conversationId as string),
      authorId: CURRENT_USER_ID,
      timestamp: Math.floor(Date.now() / 1000),
      body: body.body,
    })
    db.messages.push(message)
    return HttpResponse.json(message, { status: 201 })
  }),

  http.post(
    '/api/conversations/:conversationId/read',
    () => new HttpResponse(null, { status: 204 })
  ),

  http.get('/api/users', () =>
    HttpResponse.json([makeUser(), makeUser({ id: 3, nickname: 'Patrick' })])
  ),

  http.get('/api/products', () => HttpResponse.json([makeProduct()])),

  http.post('/api/conversations', async ({ request }) => {
    const { recipientId } = (await request.json()) as { recipientId: number; productId?: number }
    const conversation = makeConversation({
      id: db.conversations.length + 1,
      recipientId,
      recipientNickname: `Membre ${recipientId}`,
      lastMessageTimestamp: Math.floor(Date.now() / 1000),
    })
    db.conversations.push(conversation)
    return HttpResponse.json(conversation, { status: 201 })
  }),
]

/** Makes one endpoint fail, for the tests that care what happens when it does. */
export const failing = {
  sendMessage: (status = 500, message = 'Le service est momentanement indisponible.') =>
    http.post('/api/conversations/:conversationId/messages', () =>
      apiError(status, 'SERVICE_UNAVAILABLE', message)
    ),
  listMessages: (status = 503) =>
    http.get('/api/conversations/:conversationId/messages', () =>
      apiError(status, 'SERVICE_UNAVAILABLE', 'Service indisponible.')
    ),
  listConversations: (status = 503) =>
    http.get('/api/conversations', () =>
      apiError(status, 'SERVICE_UNAVAILABLE', 'Service indisponible.')
    ),
  rateLimited: () =>
    http.post('/api/conversations/:conversationId/messages', () =>
      apiError(429, 'RATE_LIMITED', 'Trop de requetes. Reessayez dans 30 seconde(s).')
    ),
}
