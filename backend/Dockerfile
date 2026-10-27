# ==============================================================================
# AssetVault: Production API Dockerfile (Multi-Stage Node.js 22 Alpine)
# Targets minimal footprint, non-root security, and automated Prisma migrations
# ==============================================================================

# Stage 1: Dependencies Resolution
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY backend/prisma ./backend/prisma/

RUN npm ci --workspace=@assetvault/api

# Stage 2: Compilation & Prisma Generation
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY backend ./backend

WORKDIR /app/backend
RUN npx prisma generate
RUN npx tsc -p tsconfig.build.json || node ../node_modules/typescript/bin/tsc -p tsconfig.build.json
RUN npx tsc -p tsconfig.seed.json || node ../node_modules/typescript/bin/tsc -p tsconfig.seed.json

# Stage 3: Production Runtime (Non-root user, slim footprint)
FROM node:22-alpine AS runner
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=5000

# Install runtime utilities (curl/wget for healthcheck) and refresh npm bundled tree for Trivy
RUN apk upgrade --no-cache && apk add --no-cache openssl curl wget libc6-compat && npm install --global npm@11 && npm cache clean --force

# Create node workspace layout
COPY package*.json /app/
COPY backend/package*.json /app/backend/
COPY frontend/package*.json /app/frontend/
COPY backend/prisma /app/backend/prisma/
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Install production-only dependencies
WORKDIR /app
RUN npm ci --workspace=@assetvault/api --omit=dev --ignore-scripts && npm cache clean --force

WORKDIR /app/backend
# Copy built artifacts from builder
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/dist-seed ./dist-seed
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# Security: Non-root execution
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
