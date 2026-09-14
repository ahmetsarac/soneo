FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
RUN pnpm install --filter server... --frozen-lockfile
COPY apps/server apps/server
RUN pnpm --filter server build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
RUN addgroup -S soneo && adduser -S soneo -G soneo
COPY --from=builder --chown=soneo:soneo /app /app
USER soneo
WORKDIR /app/apps/server
EXPOSE 4000
CMD ["node", "dist/index.js"]
