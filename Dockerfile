# Multi-stage build for production optimization
FROM node:22-alpine AS base

# Install system dependencies and pnpm
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

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files for backend and frontend
COPY backend/package*.json backend/pnpm-lock.yaml ./

# Install dependencies
FROM base AS deps
RUN pnpm install --prod --frozen-lockfile

# Build stage
FROM base AS build
COPY backend/ .
RUN pnpm install --frozen-lockfile
RUN pnpm run build

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
    freetype

WORKDIR /app

# Copy built files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Copy frontend build
COPY frontend/dist ./frontend/dist

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/main.js"]
