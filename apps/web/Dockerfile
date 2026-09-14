FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter web... --frozen-lockfile

FROM base AS builder
COPY --from=deps /app /app
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S soneo && adduser -S soneo -G soneo
COPY --from=builder --chown=soneo:soneo /app/apps/web/.next/standalone ./
COPY --from=builder --chown=soneo:soneo /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=soneo:soneo /app/apps/web/public ./apps/web/public
USER soneo
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
