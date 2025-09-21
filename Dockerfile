# ==========================================
# Etapa base común para desarrollo y producción
# ==========================================
# Use a specific Node.js LTS version with security updates
FROM node:20.18.1-slim-bookworm AS base

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Establecer el directorio de trabajo
WORKDIR /app

# ==========================================
# Etapa de desarrollo
# ==========================================
FROM base AS dev

# Install system dependencies with security updates
RUN apt-get update && apt-get upgrade -y --no-install-recommends && \
    apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de configuración
COPY package.json pnpm-lock.yaml* .npmrc ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar el resto de los archivos
COPY . .

# Puerto de desarrollo
EXPOSE 5173

# Comando para desarrollo
CMD ["pnpm", "run", "dev", "--host"]

# ==========================================
# Etapa de construcción
# ==========================================
FROM base AS builder

# Copiar archivos de configuración
COPY package.json pnpm-lock.yaml* .npmrc ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar el resto de los archivos
COPY . .

# Construir la aplicación
RUN pnpm run build

# ==========================================
# Etapa de producción
# ==========================================
FROM base AS prod

# Install system dependencies with security updates
RUN apt-get update && apt-get upgrade -y --no-install-recommends && \
    apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos necesarios
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/.svelte-kit ./.svelte-kit
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/static ./static
COPY --from=builder /app/prisma ./prisma

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "build"]
