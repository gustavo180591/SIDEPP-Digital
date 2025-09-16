# ==================================
# Base image with native dependencies (OCR/PDF)
# ==================================
FROM node:20-bookworm-slim AS base
WORKDIR /usr/src/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# ==================================
# Development Stage
# ==================================
FROM base AS dev
ENV NODE_ENV=development

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Install dependencies
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install; \
    fi

# Copy the rest of the application
COPY . .

EXPOSE 5173
CMD ["pnpm", "run", "dev", "--host", "--port", "5173"]

# ==================================
# Builder Stage (produces /build)
# ==================================
FROM base AS builder
ENV NODE_ENV=production

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Install dependencies
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install; \
    fi

# Copy the rest of the application and build
COPY . .
RUN pnpm run build

# ==================================
# Production Stage
# ==================================
FROM base AS prod
ENV NODE_ENV=production

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy the rest of the application
COPY . .

# Build the application
RUN pnpm run build

# Expose the port the app runs on
EXPOSE 3000

# Run as non-root user
RUN useradd -m appuser && chown -R appuser:appuser /usr/src/app
USER appuser

CMD ["node", "build"]