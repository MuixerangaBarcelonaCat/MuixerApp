# Stage 1: Install ALL dependencies (needed for build tools)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:22-alpine AS build
WORKDIR /app
# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disable Nx daemon (not suitable for Docker builds) and skip remote cache
ENV NX_DAEMON=false
ENV NX_SKIP_NX_CACHE=true
# Build shared lib first (api depends on it), then the API
# Use local nx binary to avoid npx downloading a different version
RUN ./node_modules/.bin/nx build shared --configuration=production && \
    ./node_modules/.bin/nx build api --configuration=production

# Stage 3: Install only production dependencies for the final image
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY --from=build /app/dist/apps/api/package.json ./
RUN pnpm install --prod --no-lockfile && \
    pnpm add pg tslib bcrypt --no-lockfile

# Stage 4: Final lightweight runner image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy the built application
COPY --from=build /app/dist/apps/api ./

# Copy production node_modules (includes native bindings like bcrypt, pg)
COPY --from=prod-deps /app/node_modules ./node_modules

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "main.js"]
