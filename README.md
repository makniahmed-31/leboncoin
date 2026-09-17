# Messagerie leboncoin — frontend

The interface for a marketplace messaging product: browse conversations, read a thread, send
messages, start new conversations about a listing, on desktop and mobile.

It is a separate repository from the API on purpose. The two have different reasons to change and
different reasons to scale, and the API is the kind of thing a mobile client, a notification worker
or an internal tool eventually needs — none of which can consume a Next.js route handler. The
backend lives in [`leboncoin-api`](../leboncoin-api) and this application talks to it over HTTP.

This README is about decisions rather than features. Where a choice cost something, the cost is
written down; where a number is quoted, it was measured rather than estimated.

---

## Running it

Requires Node 22.14 or later (see `.nvmrc`). **The API must be running first.**

```bash
# 1. the backend, in the other repository
cd ../leboncoin-api
cp .env.example .env && sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 48)|" .env
docker compose up -d && pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev

# 2. this application
cd ../leboncoin
cp .env.example .env.local
# AUTH_SECRET must match the API's — this app verifies the session cookie's signature.
npm install
npm run dev          # http://localhost:3000
```

Sign in as **Thibaut**, **Elodie** or **Yasmine**. There are no passwords; the API's README explains
exactly how far that goes.

To watch the interface handle a dead backend:

```bash
CHAOS_RATE=0.3 npm run dev   # 30% of calls to the API fail
CHAOS_RATE=1   npm run dev   # total outage
```

### Checks

```bash
npm test          # unit and component tests (Vitest, Testing Library, MSW) — 79
npm run e2e       # end-to-end (Playwright, three browser projects) — needs the API running
npm run verify    # format, lint, boundaries, types, tests, build — what CI runs
```

---

## Architecture

```text
   Browser
      │  same-origin only
      ▼
┌─────────────────────────────┐
│  Next.js (this repository)  │
│                             │
│  Server Components ─────────┼──────► leboncoin-api ──► PostgreSQL
│  Route handlers (BFF) ──────┼──────►                   Redis
│    read httpOnly cookie,    │
│    forward a bearer token   │
└─────────────────────────────┘
```

The browser only ever talks to this origin. Route handlers read the session cookie and call the API
with a bearer token; Server Components call the API directly. The API needs no public ingress.

### Why a BFF in front of the API

`src/app/api/[...path]/route.ts` is one generic proxy and adds no business logic. It exists for one
reason: **the session token never enters the browser.**

A token in `localStorage` is a token any injected script can read, and "we have no XSS" is a claim
about every dependency in the bundle rather than about code anyone has reviewed. Here the cookie is
httpOnly, the proxy attaches the bearer server-side, and an e2e test asserts that `document.cookie`,
`localStorage` and `sessionStorage` contain nothing resembling a credential.

Two things fall out of that. The browser makes same-origin requests, so there is no CORS
configuration and no `SameSite=None` cookie to get wrong. And the API is unweakened by it — it
authenticates and authorises every request identically whether the caller is this proxy or `curl`,
which is the only version of that guarantee worth having.

Writing one catch-all rather than a handler per endpoint is deliberate. A handler per endpoint would
restate the API's routes in a second place and keep them in step by hand; expressing a pass-through
once is both less code and a more honest description of what it does. Only the three routes that
genuinely need special handling have their own file: login (sets the cookie), logout (clears it) and
the event stream (must not be buffered).

Headers are never forwarded wholesale. A client-supplied `authorization` would override the one
derived from the verified session, and a client-supplied `x-forwarded-for` would poison the API's
logs. Only the request id crosses, so one identifier spans both services.

---

## Next.js: Server Components by default

Only four components in the application are client components, and each has a reason that is about
interaction rather than convenience:

| Component         | Why it is a client component                     |
| ----------------- | ------------------------------------------------ |
| conversation list | infinite scroll, search input, live invalidation |
| message thread    | virtualiser, scroll anchoring, optimistic outbox |
| composer          | draft state, keyboard handling                   |
| login form        | form state and submission                        |

Everything else — layouts, the thread page, the login page, the listing badge — renders on the
server and ships no JavaScript.

The other half of that decision is how data crosses the boundary. The server prefetches into a
`QueryClient` and hands it over with `dehydrate()` / `HydrationBoundary` rather than passing rows as
props. Props would put the same data in two places and the first client refetch would throw the
server's copy away; dehydration means the client's `useInfiniteQuery` finds a warm cache under the
key it was going to use anyway, so the first paint has content and no request goes out.

The layout's prefetch is deliberately not allowed to throw. A dead API still renders the shell, the
list's own error state and the composer — the client query picks up the failure and offers a retry.

The auth gate lives in the conversations layout rather than in middleware. Middleware runs before
every request including static assets, and verifying a signature there puts crypto on a path that
mostly serves images. The layout wraps every authenticated route, runs once per navigation, and
shares its verification with the page inside it through React's request cache.

---

## State management

```text
Server state          → TanStack Query
Client UI state       → Zustand
Infrastructure        → React Context (QueryClient, theme, live transport)
```

There is no `ChatContext`, `ConversationContext` or `MessageContext`, and their absence is the
decision, not an oversight.

Server state is not application state — it is a cache of something that lives elsewhere, and it
needs staleness, deduplication, retries, background refresh and invalidation. A context holding
conversations has none of that, so it gets reimplemented badly, and every consumer re-renders on
every update because context has no selector.

What genuinely is client state is small: per-conversation drafts and the outbox of unconfirmed
messages. Both are Zustand stores, which have selectors, so a keystroke in the composer does not
re-render the conversation list.

Two contexts exist. `QueryClientProvider`, because the cache must be one instance created per
request rather than per module — two concurrent visitors on the server would otherwise share a
cache. And `LiveProvider`, because the event stream is one long-lived connection several unrelated
screens share; it exposes a status and a subscription and holds no business state.

**The open conversation is not in a store.** It is in the URL. Mirroring it into Zustand would
create a second source of truth and break deep links and back navigation.

---

## Real-time

Nothing in the UI knows how an update arrived. Components subscribe to a `MessageTransport`:

```ts
interface MessageTransport {
  connect(): void
  disconnect(): void
  watch(conversationId: number | null): void
  subscribe(listener: (event: TransportEvent) => void): () => void
}
```

Two implementations exist and both are real — server-sent events, and a polling fallback. Switching
between them is `NEXT_PUBLIC_TRANSPORT` and nothing else: no component, hook or cache interaction
changes, because none of them can tell how an event arrived. Writing the pushed one _second_ is what
proved the interface; an abstraction shaped around polling would have leaked an interval or a
refetch callback into it, and neither appears.

`EventSource` cannot set headers — usually the reason people reach for WebSockets — but it sends
cookies on a same-origin request, and the session here _is_ a same-origin httpOnly cookie. So the
stream is authenticated exactly like every other request, with no special case, and it reconnects on
its own.

Polling stays as the fallback rather than dead code: some corporate proxies buffer
`text/event-stream` into uselessness, and that is a real condition to degrade into rather than break
on.

Events carry identifiers, never message bodies, so there is exactly one code path writing into the
query cache. A notification for the open thread refetches its newest page; a notification for any
other conversation only refreshes the list, because fetching the messages of a thread nobody is
looking at is pure waste.

---

## Sending a message

```text
composer → outbox (sending) → POST → sent
                                   → failed → retry (same clientId)
```

The optimistic row lives in a Zustand outbox **beside** the query cache, not inside it. The message
cache is an infinite query paged newest-first; splicing a provisional row into page zero and
removing it on failure means reaching into the cache's internal page structure, which breaks the
moment paging changes. Keeping them separate is also why a failed message can stay on screen with a
retry button instead of vanishing.

The `clientId` is generated once per message and reused across every retry of that message. That is
what makes a retry safe after a timeout, where the browser genuinely cannot distinguish a lost
request from a lost response — the API resolves the replay to the original message.

An offline send is parked rather than attempted: firing it would burn the retry budget on failures
we already know about, and the user would watch it fail for no reason.

No form library for the composer. It is a single textarea whose only rule is a length check already
shared with the API, and its absence is a choice rather than an omission — React Hook Form is used
where there is a real form, on the login screen. Enter sends, Shift+Enter breaks the line, and
`isComposing` is checked so an IME candidate confirmed with Enter does not send.

---

## Performance

The message thread is virtualised with TanStack Virtual — **47 rendered rows for a 5,000-message
thread** — and holds the viewport still when older messages are prepended, so loading history does
not throw the reader's place away.

The conversation list prefetches a thread on hover, focus and touchstart, so by the time a tap lands
the messages are usually already cached and the pane renders without a skeleton. Rows are memoised,
because the list re-renders on every live event and the profiler showed the whole list reconciling
for no visible change. Search is debounced at 300 ms; without it, typing eight characters is eight
requests of which seven are stale on arrival.

Live updates refresh **only the newest page** rather than invalidating the infinite query.
Invalidating refetches every loaded page — on a thread scrolled back ten pages, that is ten refetches
to discover one new message.

Retries distinguish 4xx from 5xx, because a 400 cannot become a 200 by being asked again, and backoff
is jittered so clients that failed together do not retry together.

The schemas in `src/lib/contracts` are written against `zod/mini` rather than the chainable API,
because they are imported by client components and the validation runtime ships to the browser.
Measured on a production build, the classic build cost about 97 kB gzip against about 5 kB for
identical checks — roughly a third of the page's JavaScript. The functional style reads a little
heavier; that was the right trade.

---

## The API contract

`src/lib/contracts` mirrors `leboncoin-api/src/contracts`. Two repositories cannot share a workspace
package, and the honest options were: vendor a copy, publish the contract to a registry, or generate
types from the API's OpenAPI document. This is the first, and the trade is stated rather than hidden
— a copy can drift, and nothing detects that automatically.

What makes the drift survivable is that these schemas are **parsed against every response**, not
merely used as types. A backend that changes shape produces a `MALFORMED_RESPONSE` error with a
request id rather than an `undefined` rendering three components deep. The production answer is a
published package consumed by both sides, which is a registry away rather than a redesign.

It lives under `lib/` rather than `shared/` because everything depends on it and the layering rule
only allows arrows to point downward — a fact the boundary checker enforced rather than a
preference.

---

## Error handling and resilience

One error shape, whether it came from this tier or the API:

```json
{ "statusCode": 404, "code": "CONVERSATION_NOT_FOUND", "message": "…", "requestId": "…" }
```

The codes are the API's own, imported rather than restated — a second list on the client is a list
that drifts, and the drift shows up as a fallback message for a case somebody thought they had
handled. The proxy passes the API's body through verbatim, so a client cannot tell which tier
refused it and there is no second error format to keep in step.

The interface has loading, empty, error and offline states; `error.tsx` at the segment level so a
failing thread does not take the list with it; `global-error.tsx`; `not-found.tsx`. Two empty states
for the conversation list, because "no results" and "no conversations at all" mean different things
and only one of them is a dead end.

A dedicated Playwright project runs against a real instance with `CHAOS_RATE=1` and asserts the
application degrades rather than breaking — the shell renders, the error states offer a retry, and
nothing on the page is a raw stack trace. That path cannot be tested with `page.route`, because the
pages fetch their first data on the server and the browser never sees that request.

---

## Accessibility

Targeting WCAG 2.2 AA, with semantic HTML first and ARIA only where HTML has no equivalent.

Both panes are real routes, so the back button and the phone's back gesture work without
interception, and the hidden pane is `display:none` so it leaves the tab order entirely. Opening a
thread moves focus to its header — without that, a keyboard user has to tab past every remaining
conversation to reach the composer, which is fifty-odd stops on the seeded data. Incoming messages
are announced through a polite live region that excludes the member's own. Search result counts are
announced too; otherwise the list silently changes under the cursor. Radix owns the dialog, so focus
trapping, Escape and focus restoration to the trigger are handled by code tested by more people than
this.

Zoom is not locked. The brand orange is darkened from the marketing colour on purpose: white on
`#ec5a13` measures 3.48:1 and fails AA, `#c9490c` reaches 4.73:1. There is no `autoFocus` on the
login field — moving focus on load skips the heading that says which application this is.

Automated axe checks run in both the component suite and the Playwright suite. They catch perhaps a
third of what matters, which is why the decisions above are in the markup rather than in a checklist.

---

## Testing

```text
      ╱ E2E ╲          Playwright, 3 projects: desktop, mobile, outage
    ╱─────────╲        journeys, auth, mobile navigation, keyboard, axe
  ╱   Unit /    ╲      79 tests: components against MSW, transport, schemas,
 ╱   component   ╲     retry policy, date formatting
╱─────────────────╲
```

Component tests run against MSW, so the client is exercised against the contract the proxy passes
through and a test can choose its failure — a 500 on send, a slow page, a rate limit.

jsdom ships no `EventSource`, so the suite includes a controllable stub rather than mocking the
transport away: a test can push a server event into the running application and assert what the
interface does with it. It also reports every element as zero-sized, which is why the thread test
gives the scroll container an explicit viewport — otherwise the virtualiser renders nothing and the
test passes for the wrong reason.

The e2e suite expects a running API rather than starting one. Reaching across the filesystem to boot
a sibling checkout would work on the machine it was written on and nowhere else, and would quietly
couple two repositories that deploy independently. CI checks the API out explicitly and starts it,
which makes that coupling visible in one place.

---

## Deployment

A single image from the `Dockerfile` at the root: Next.js standalone output, so it carries the
traced module graph and a minimal server rather than the whole of `node_modules`. Runs as the
unprivileged `node` user.

That output is opt-in — the build stage sets `BUILD_STANDALONE=1` — rather than always on, because
`next start` refuses to serve a standalone build and the Playwright suite's web server runs
`next start`. Turning it on unconditionally would trade a working browser suite for a smaller
image.

Only `NEXT_PUBLIC_*` values are build arguments, because Next inlines them into the client bundle
and they cannot be changed by restarting a container. Everything environment-specific — `API_URL`,
`AUTH_SECRET` — is read at runtime, which is what lets one image be promoted from staging to
production.

`API_URL` is deliberately **not** `NEXT_PUBLIC_`. The browser never sees the API's host and never
needs to resolve it, which is what allows the API to sit on a private network.

This tier holds no database or cache credentials. A compromise of the web tier cannot become a
compromise of the data tier — a property that is easy to state and easy to lose, so it is worth
checking whenever the environment block changes.

`/api/health` reports this container's own liveness plus whether it can see the API. The API's
reachability is reported alongside rather than folded into the status, because the application still
renders a usable error state when the API is down and a container working as designed should not be
restarted for it.

### CI

`install → format → lint → boundaries → typecheck → unit → build → e2e`, with the e2e job gated
behind the cheap ones and checking out the API repository to run against. A single `CI` job
aggregates the rest, so branch protection names one check and a newly added job cannot silently
become optional.

---

## Code quality

Strict TypeScript, `noUncheckedIndexedAccess` included, and no `any`.

Toolchain is **oxlint and oxfmt** rather than ESLint and Prettier — one Rust toolchain, about 300 ms
across the tree, and the rules that matter here (`jsx-a11y`, `import/no-cycle`,
`typescript/no-explicit-any`) are all present. oxlint has no `no-restricted-imports`, so the layering
rule has its own checker in `scripts/check-boundaries.ts`, which walks the import graph and runs in
CI and the pre-commit hook:

```text
app → features → shared → stores → lib      (arrows only point right)
```

It also refuses one feature rendering another feature's components directly. It is not decoration:
it is what caught the API contract sitting in `shared/` while `lib/` imported it.

---

## Known gaps

- **Listing photos are not rendered.** The contract carries `imageUrl`; the corpus has none, and an
  image branch that has never executed is worse than its absence.
- **The Docker image was not built in the environment this was written in** — the registry there was
  too slow to complete a cold install inside a container. The Dockerfile is complete and the
  application was built and run outside a container against the real API throughout.
- **The contract is vendored, not published.** Explained above.

---

## Future evolution

- **WebSockets** — a third implementation of `MessageTransport`. The UI does not change. Worth doing
  when the client needs to _send_ over the socket (typing indicators, presence), not before.
- **A published contract package**, replacing the vendored copy.
- **Route-level streaming** — the thread page could stream its header before its messages resolve;
  the shell already renders independently of the data.
- **Read receipts and presence**, both of which are new event types the transport already carries.
