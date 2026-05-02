# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/responder/package.json ./packages/responder/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/responder ./packages/responder

RUN pnpm --filter @d1dx/paperclip-gchat-bridge-shared build \
  && pnpm --filter @d1dx/paperclip-gchat-responder build

FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=builder /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/responder/package.json ./packages/responder/
COPY --from=builder /app/packages/responder/dist ./packages/responder/dist

RUN pnpm install --prod --frozen-lockfile

EXPOSE 8787
ENV NODE_ENV=production
CMD ["node", "packages/responder/dist/server.js"]
