# Stage 1: Install ALL dependencies (needed for build tools)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

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

# Stage 3: Serve static files with nginx
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built Angular app
COPY --from=build /app/dist/apps/dashboard/browser /usr/share/nginx/html

# Non-root user for security
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx-user -g nginx-user nginx-user && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

USER nginx-user

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
