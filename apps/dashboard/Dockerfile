# Stage 1: Install ALL dependencies (needed for build tools)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the Angular application
FROM node:22-alpine AS build
WORKDIR /app
# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disable Nx daemon and remote cache (not suitable for Docker builds)
ENV NX_DAEMON=false
ENV NX_SKIP_NX_CACHE=true
# Build shared lib first (dashboard depends on it), then the dashboard with PRE config
RUN ./node_modules/.bin/nx build shared --configuration=production && \
    ./node_modules/.bin/nx build dashboard --configuration=pre

# Stage 3: Serve static files with Caddy
FROM caddy:alpine AS runner

# Copy Caddy configuration
COPY apps/dashboard/Caddyfile /etc/caddy/Caddyfile

# Copy the built Angular app
COPY --from=build /app/dist/apps/dashboard/browser /srv

EXPOSE 80
EXPOSE 443

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
