/**
 * The conversation contract, owned by the shared package and re-exported here.
 *
 * The schemas are written against `zod/mini` rather than the chainable API, and that choice is
 * made where they are defined because it is a client-bundle decision: these modules are imported
 * by client components, so the validation runtime ships to the browser. Measured on a production
 * build, the classic build costs about 97 kB gzip and this one about 5 kB, for identical checks.
 */
export {
  PREVIEW_LENGTH,
  conversationListSchema,
  conversationPageSchema,
  conversationSchema,
  counterpartOf,
  createConversationInputSchema,
  formatPrice,
  productSchema,
  userListSchema,
  userSchema,
  type Conversation,
  type ConversationPage,
  type CreateConversationInput,
  type Product,
  type User,
} from '@/lib/contracts'
