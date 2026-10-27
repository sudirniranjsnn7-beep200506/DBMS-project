# ==============================================================================
# AssetVault: Production Web Frontend Dockerfile (Vite Build + Nginx Alpine)
# ==============================================================================

# Stage 1: Build Frontend Assets
FROM node:22-alpine AS builder

WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache libc6-compat

# Copy dependency manifests
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install build dependencies
RUN npm ci --workspace=@assetvault/web

# Copy web source files
COPY frontend ./frontend

WORKDIR /app/frontend
ENV VITE_API_URL=/api
RUN node ../node_modules/vite/bin/vite.js build

# Stage 2: Ultra-Slim Production Nginx Runtime
FROM nginx:alpine AS runner

# Apply security updates to packages in the Nginx base image.
RUN apk upgrade --no-cache

# Remove default nginx HTML templates
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy optimized Nginx configuration and security headers snippet
COPY frontend/security-headers.conf /etc/nginx/security-headers.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
