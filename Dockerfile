# syntax=docker/dockerfile:1

# ---- deps: install workspace dependencies (cached layer) ----
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/widget/package.json packages/widget/
COPY packages/video/package.json packages/video/
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
RUN npm run worker:build --workspace=@vouchreel/dashboard

# ---- migrator: one-shot drizzle-kit migrations (used by docker-compose.production.yml) ----
FROM builder AS migrator
WORKDIR /repo/apps/dashboard
CMD ["npx", "drizzle-kit", "migrate"]

# ---- runner: minimal production image ----
FROM node:24-alpine AS runner
# ffmpeg for transcoding/social exports; fontconfig + Noto fonts so drawtext (burned-in captions) works
RUN apk add --no-cache libc6-compat ffmpeg fontconfig font-noto \
 && ffmpeg -hide_banner -filters | grep -q drawtext
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

# ---- worker: background job processor (renders videos; needs ffmpeg + full node_modules) ----
FROM builder AS worker
RUN apk add --no-cache ffmpeg fontconfig font-noto  && ffmpeg -hide_banner -filters | grep -q drawtext
ENV NODE_ENV=production
WORKDIR /repo/apps/dashboard
USER node
CMD ["node", "dist/worker.mjs"]

# ---- video-worker: renders Remotion review videos (needs Chromium, so Debian rather than Alpine) ----
# Built separately from the Alpine stages: native packages (Remotion's compositor) differ per libc.
# Unverified in CI: build it once on your host and render a test video before relying on it.
FROM node:24-bookworm-slim AS video-worker
ENV NODE_ENV=production     NEXT_TELEMETRY_DISABLED=1     DEBIAN_FRONTEND=noninteractive
# Chromium runtime libraries (see https://www.remotion.dev/docs/miscellaneous/linux-dependencies) + fonts
# that cover non-Latin reviews (the bundled Outfit/Playfair fonts are Latin only)
RUN apt-get update && apt-get install -y --no-install-recommends       libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libasound2 libxrandr2 libxkbcommon0       libxfixes3 libxcomposite1 libxdamage1 libgbm1 libcups2 libpango-1.0-0 libcairo2       fonts-noto-core fonts-noto-cjk fonts-noto-color-emoji ca-certificates     && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/widget/package.json packages/widget/
COPY packages/video/package.json packages/video/
# Full install: the worker bundle and the Remotion bundle are built below (tsx/esbuild are dev dependencies)
RUN NODE_ENV=development npm ci
COPY apps/dashboard apps/dashboard
COPY packages/video packages/video
# Worker entry point (the Next.js app is not needed here)
RUN npm run worker:build --workspace=@vouchreel/dashboard
# Pre-build the compositions so the worker never runs webpack at start-up, and bake Chromium into the image
RUN npm run bundle --workspace=@vouchreel/video -- /repo/video-bundle  && cd /repo/packages/video && npx remotion browser ensure
ENV VIDEO_BUNDLE_DIR=/repo/video-bundle     VIDEO_ENTRY_POINT=/repo/packages/video/src/entry.tsx     VIDEO_RENDER_CONCURRENCY=2     WORKER_CONCURRENCY=1
RUN chown -R node:node /repo
USER node
WORKDIR /repo/apps/dashboard
CMD ["node", "dist/video-worker.mjs"]
