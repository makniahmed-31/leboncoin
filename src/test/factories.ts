import type { Conversation, Product, User } from '@/features/conversations/schemas'
import type { Message } from '@/features/messages/schemas'

export const CURRENT_USER_ID = 1

export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    senderId: CURRENT_USER_ID,
    senderNickname: 'Thibaut',
    recipientId: 2,
    recipientNickname: 'Jeremie',
    lastMessageTimestamp: 1_700_000_000,
    unreadCount: 0,
    ...overrides,
  }
}

export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    conversationId: 1,
    authorId: 2,
    timestamp: 1_700_000_000,
    body: 'Bonjour',
    ...overrides,
  }
}

export function makeUser(overrides: Partial<User> = {}): User {
  return { id: 2, nickname: 'Jeremie', ...overrides }
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'Canape 3 places en velours vert',
    priceCents: 35_000,
    currency: 'EUR',
    sellerId: 2,
    ...overrides,
  }
}
