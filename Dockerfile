# ==========================================
# Etapa base común para desarrollo y producción
# ==========================================
# Use Node.js 20 LTS (bookworm slim)
FROM node:20-bookworm-slim AS base

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
COPY package.json package-lock.json* ./

# Instalar dependencias
RUN npm ci

# Copiar el resto de los archivos
COPY . .

# Puerto de desarrollo
EXPOSE 5173

# Comando para desarrollo
CMD ["npm", "run", "dev", "--", "--host"]

# ==========================================
# Etapa de construcción
# ==========================================
FROM base AS builder

# Copiar archivos de configuración
COPY package.json package-lock.json* ./

# Instalar dependencias
RUN npm ci

# Copiar el resto de los archivos
COPY . .

# Construir la aplicación
RUN npm run build

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
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/.svelte-kit ./.svelte-kit
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/static ./static
COPY --from=builder /app/prisma ./prisma

# Generar Prisma Client con el schema correcto
RUN npx prisma generate

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "build"]
