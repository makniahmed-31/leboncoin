/**
 * Regenerates src/server/db.json.
 *
 * The fixtures shipped with the starter hold 3 conversations and 4 messages, which is not enough
 * to tell a virtualized list from a naive one, or a paginated fetch from a full dump. This script
 * keeps those original records byte-for-byte at the head of each collection so the documented
 * examples still resolve, then appends a larger synthetic corpus around them.
 *
 * Output is deterministic: the PRNG is seeded and the clock is pinned, so the file only changes
 * when this script does.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The "now" that generated threads are placed behind.
 *
 * This was `Date.now()`, which quietly made the output drift: every run shifted all 7,313
 * timestamps by however many seconds had passed since the last one, so `npm run seed` rewrote the
 * entire fixture file even when nothing about this script had changed, and the committed data
 * could not be reproduced from the script that claims to produce it.
 *
 * Pinning it costs something real — the stamps in the list are relative, so a fixture left alone
 * for months reads as dates rather than "hier". That is the better trade: a fixture you can
 * regenerate and get the same bytes back is worth more than one that always looks fresh, and
 * `SEED_NOW=$(date +%s) npm run seed` brings the data forward whenever it is wanted.
 */
const SEED_NOW = Number(process.env.SEED_NOW ?? 1_789_500_000)

const ORIGINAL = {
  users: [
    { id: 1, nickname: 'Thibaut', token: 'xxxx' },
    { id: 2, nickname: 'Jeremie', token: 'xxxx' },
    { id: 3, nickname: 'Patrick', token: 'xxxx' },
    { id: 4, nickname: 'Elodie', token: 'xxxx' },
  ],
  conversations: [
    {
      id: 1,
      recipientId: 2,
      recipientNickname: 'Jeremie',
      senderId: 1,
      senderNickname: 'Thibaut',
      lastMessageTimestamp: 1625637849,
    },
    {
      id: 2,
      recipientId: 3,
      recipientNickname: 'Patrick',
      senderId: 1,
      senderNickname: 'Thibaut',
      lastMessageTimestamp: 1620284667,
    },
    {
      id: 3,
      recipientId: 1,
      recipientNickname: 'Thibaut',
      senderId: 4,
      senderNickname: 'Elodie',
      lastMessageTimestamp: 1625648667,
    },
  ],
  messages: [
    {
      id: 1,
      conversationId: 1,
      timestamp: 1625637849,
      authorId: 1,
      body: "Bonjour c'est le premier message de la première conversation",
    },
    {
      id: 2,
      conversationId: 1,
      timestamp: 1625637867,
      authorId: 1,
      body: "Bonjour c'est le second message de la première conversation",
    },
    {
      id: 3,
      conversationId: 1,
      timestamp: 1625648667,
      authorId: 2,
      body: "Bonjour c'est le troisième message de la première conversation",
    },
    {
      id: 4,
      conversationId: 2,
      timestamp: 1620284667,
      authorId: 2,
      body: "Bonjour c'est le premier message de la seconde conversation",
    },
  ],
}

const LOGGED_USER_ID = 1
const EXTRA_USERS = 24
const EXTRA_CONVERSATIONS = 60
/** One thread is deliberately enormous so the message list has something to virtualize. */
const BUSY_THREAD_MESSAGES = 5000
const NICKNAMES = [
  'Amandine',
  'Baptiste',
  'Camille',
  'Damien',
  'Emma',
  'Farid',
  'Gaelle',
  'Hugo',
  'Ines',
  'Julien',
  'Karim',
  'Louise',
  'Mathieu',
  'Nadia',
  'Olivier',
  'Pauline',
  'Quentin',
  'Rachid',
  'Sophie',
  'Thomas',
  'Ugo',
  'Valerie',
  'William',
  'Yasmine',
]

/** mulberry32 — small, seedable, good enough for fixtures. */
function createRandom(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = createRandom(20240614)
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

const OPENERS = [
  "Bonjour, l'annonce est toujours disponible ?",
  'Bonsoir, est-ce que le prix est negociable ?',
  'Salut, je peux passer le voir demain ?',
  'Bonjour, vous seriez ou exactement pour la remise en main propre ?',
  'Bonjour, auriez-vous des photos supplementaires ?',
]
const REPLIES = [
  'Oui tout a fait, il est encore dispo.',
  'Je peux faire un petit geste si vous prenez le lot.',
  'Demain apres 18h ca m irait bien.',
  'Je suis proche de la gare, on peut se retrouver la.',
  'Je vous envoie des photos ce soir.',
  "C'est note, a demain alors.",
  'Parfait, merci beaucoup pour votre reponse.',
  "Desole, j'ai eu une autre proposition entre temps.",
  "L'objet a tres peu servi, il est comme neuf.",
  'La livraison est possible mais a votre charge.',
]

type User = (typeof ORIGINAL.users)[number]
type Conversation = (typeof ORIGINAL.conversations)[number]
type Message = (typeof ORIGINAL.messages)[number]

const users: User[] = [...ORIGINAL.users]
for (let i = 0; i < EXTRA_USERS; i += 1) {
  users.push({ id: users.length + 1, nickname: NICKNAMES[i]!, token: 'xxxx' })
}
const nicknameOf = (id: number) => users.find((user) => user.id === id)!.nickname

const conversations: Conversation[] = [...ORIGINAL.conversations]
const messages: Message[] = [...ORIGINAL.messages]
let nextMessageId = messages.length + 1

function addThread(conversationId: number, participants: [number, number], count: number) {
  // Build the gaps first, then slide the whole thread so its last message lands at endedAt.
  // Generating forward from a guessed start instead would let long threads run past "now".
  const endedAt = SEED_NOW - between(0, 60 * 60 * 24 * 40)
  const offsets: number[] = [0]
  for (let index = 1; index < count; index += 1) {
    offsets.push(offsets[index - 1]! + between(45, 4800))
  }
  const startedAt = endedAt - offsets[offsets.length - 1]!

  for (let index = 0; index < count; index += 1) {
    messages.push({
      id: nextMessageId++,
      conversationId,
      timestamp: startedAt + offsets[index]!,
      authorId: index === 0 ? participants[0] : pick(participants),
      body: index === 0 ? pick(OPENERS) : pick(REPLIES),
    })
  }

  return endedAt
}

for (let index = 0; index < EXTRA_CONVERSATIONS; index += 1) {
  const conversationId = conversations.length + 1
  const other = users[between(1, users.length - 1)]!
  // Roughly one conversation in six leaves the logged user out entirely, so the filtering in
  // the json-server middleware has something to actually filter.
  const involvesLoggedUser = index % 6 !== 5
  const bystander = users[between(1, users.length - 1)]!
  const senderId = involvesLoggedUser ? (index % 2 === 0 ? LOGGED_USER_ID : other.id) : bystander.id
  const recipientId = involvesLoggedUser ? (index % 2 === 0 ? other.id : LOGGED_USER_ID) : other.id

  if (senderId === recipientId) continue

  const count = index === 0 ? BUSY_THREAD_MESSAGES : between(4, 80)
  const lastMessageTimestamp = addThread(conversationId, [senderId, recipientId], count)

  conversations.push({
    id: conversationId,
    senderId,
    senderNickname: nicknameOf(senderId),
    recipientId,
    recipientNickname: nicknameOf(recipientId),
    lastMessageTimestamp,
  })
}

const target = join(import.meta.dirname, '..', 'src', 'server', 'db.json')
writeFileSync(target, `${JSON.stringify({ conversations, messages, users }, null, 2)}\n`)

const visible = conversations.filter(
  (conversation) =>
    conversation.senderId === LOGGED_USER_ID || conversation.recipientId === LOGGED_USER_ID
)
console.log(
  `${conversations.length} conversations (${visible.length} visible to user ${LOGGED_USER_ID}), ` +
    `${messages.length} messages, ${users.length} users -> src/server/db.json`
)
