# Stage 1: Install ALL dependencies (needed for build tools)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the Angular PWA application
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NX_DAEMON=false
ENV NX_SKIP_NX_CACHE=true
RUN ./node_modules/.bin/nx build shared --configuration=production && \
    ./node_modules/.bin/nx build pwa --configuration=pre

# Stage 3: Serve static files with Caddy
FROM caddy:alpine AS runner

COPY apps/pwa/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/apps/pwa/browser /srv

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
