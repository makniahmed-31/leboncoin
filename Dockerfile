# syntax=docker/dockerfile:1.7

FROM node:22.14-alpine AS base
WORKDIR /app

# ---- dependencies -----------------------------------------------------------------------------
FROM base AS deps

# Manifests before source, so a source-only change reuses this layer instead of reinstalling the
# whole dependency tree.
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ------------------------------------------------------------------------------------
FROM deps AS build

# Only the variables Next inlines into the client bundle are build arguments, and that is the whole
# rule: a NEXT_PUBLIC_ value is baked into JavaScript and cannot be changed by restarting the
# container. Everything environment-specific — API_URL, AUTH_SECRET — is read at runtime instead,
# which is what lets one image be promoted from staging to production.
ARG NEXT_PUBLIC_TRANSPORT=sse
ENV NEXT_PUBLIC_TRANSPORT=$NEXT_PUBLIC_TRANSPORT
ENV NEXT_TELEMETRY_DISABLED=1

# Asks for the traced standalone output, which is what the runtime stage below copies. It is off
# by default in next.config.ts because `next start` cannot serve it, and the e2e suite needs
# `next start` — so the image opts in rather than everything else opting out.
ENV BUILD_STANDALONE=1

COPY . .
RUN npm run build

# ---- runtime ----------------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# node:alpine ships an unprivileged `node` user. Running as root inside a container means a
# container escape starts as root, for no benefit to a process that only listens on a port.
USER node

# Three copies, and the split is what standalone output requires. `.next/standalone` holds the
# server and its traced dependencies; static assets and the public directory are not traced, so
# they have to be placed where that server expects them.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

EXPOSE 3000

# No `next start`: standalone emits its own server, and the Next CLI is not in this image.
CMD ["node", "server.js"]
