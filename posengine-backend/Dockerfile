# =========================
# STAGE 1 - BUILD
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencias (cache optimizado)
COPY package*.json ./
RUN npm ci

# Prisma schema
COPY prisma ./prisma

# Generar Prisma Client (tu output es src/generated)
RUN npx prisma generate

# Código fuente
COPY . .

# Build NestJS
RUN npm run build


# =========================
# STAGE 2 - PRODUCTION
# =========================
FROM node:20-alpine

WORKDIR /app

# Dependencias de producción + CLI de Prisma para migrate deploy en arranque
COPY package*.json ./
RUN npm ci --omit=dev \
  && npm install prisma@7.7.0

# Config y migraciones Prisma (Prisma 7 usa prisma.config.ts)
COPY prisma ./prisma
COPY prisma.config.ts ./

# Código compilado
COPY --from=builder /app/dist ./dist

# Prisma client generado (TU CONFIG ACTUAL)
COPY --from=builder /app/src/generated ./src/generated

# Carpeta uploads (filesystem interno del container)
RUN mkdir -p uploads

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Puerto backend
EXPOSE 3005

ENTRYPOINT ["./docker-entrypoint.sh"]