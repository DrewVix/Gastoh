# ── Stage 1: instalar dependencias ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# OpenSSL necesario para Prisma durante el build (static page generation)
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Genera el cliente de Prisma y compila Next.js
RUN npx prisma generate
RUN npm run build

# ── Stage 3: imagen final (solo lo necesario) ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# OpenSSL requerido por Prisma en Alpine (musl)
RUN apk add --no-cache openssl

# Usuario no-root por seguridad
RUN addgroup -S gastoh && adduser -S gastoh -G gastoh

# Ficheros del build standalone
COPY --from=builder --chown=gastoh:gastoh /app/.next/standalone ./
COPY --from=builder --chown=gastoh:gastoh /app/.next/static ./.next/static
COPY --from=builder --chown=gastoh:gastoh /app/public ./public

# Prisma: schema + migraciones + cliente generado + seed
COPY --from=builder --chown=gastoh:gastoh /app/prisma ./prisma
COPY --from=builder --chown=gastoh:gastoh /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=gastoh:gastoh /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=gastoh:gastoh /app/node_modules/prisma ./node_modules/prisma

# Script de arranque
COPY --chown=gastoh:gastoh docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Directorio de datos (se monta como volumen)
RUN mkdir -p /app/prisma/data && chown gastoh:gastoh /app/prisma/data

USER gastoh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
