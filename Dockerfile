# Multi-stage build for production optimization
FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force
RUN cd frontend && npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
COPY . .
RUN npm ci
RUN cd frontend && npm ci
RUN npm run build:all

# Production stage
FROM node:22-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S silentbot -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=build --chown=silentbot:nodejs /app/dist ./dist
COPY --from=build --chown=silentbot:nodejs /app/frontend/dist ./frontend/dist
COPY --from=deps --chown=silentbot:nodejs /app/node_modules ./node_modules
COPY --chown=silentbot:nodejs package*.json ./

# Create data directories
RUN mkdir -p data/database data/media data/auth data/logs
RUN chown -R silentbot:nodejs data

# Switch to non-root user
USER silentbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
