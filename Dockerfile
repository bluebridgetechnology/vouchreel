# syntax=docker/dockerfile:1

# ---- deps: install workspace dependencies (cached layer) ----
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/widget/package.json packages/widget/
RUN npm ci

# ---- builder: compile the embed widget + the dashboard ----
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo ./
COPY . .
# NEXT_PUBLIC_* values are inlined at build time; pass real URLs at build.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_WIDGET_URL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_WIDGET_URL=$NEXT_PUBLIC_WIDGET_URL
RUN npm run widget:build --workspace=@vouchreel/widget
RUN npm run build --workspace=@vouchreel/dashboard

# ---- migrator: one-shot drizzle-kit migrations (used by docker-compose.production.yml) ----
FROM builder AS migrator
WORKDIR /repo/apps/dashboard
CMD ["npx", "drizzle-kit", "migrate"]

# ---- runner: minimal production image ----
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/public ./apps/dashboard/public
# Run from the app directory so process.cwd()-relative reads (public/widget) resolve correctly
WORKDIR /app/apps/dashboard
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
