# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
ENV TZ=America/Argentina/Buenos_Aires
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# ---------- build ----------
FROM node:20-bookworm-slim AS build
ENV TZ=America/Argentina/Buenos_Aires
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------- runtime ----------
FROM node:20-bookworm-slim AS prod
ENV NODE_ENV=production
ENV TZ=America/Argentina/Buenos_Aires
WORKDIR /app

# Dependencias del sistema para OCR y procesamiento de PDFs
RUN apt-get update && apt-get upgrade -y --no-install-recommends && \
    apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copiamos lo minimo necesario para correr adapter-node
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# adapter-node arranca con esto
CMD ["node", "build/index.js"]
