# =========================
# STAGE 1 - BUILD
# =========================
FROM node:24-alpine AS builder

WORKDIR /app

# Dependencias (cache optimizado)
COPY package*.json ./

# Prisma schema
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci

# Código fuente
COPY . .

# Build NestJS; the prebuild lifecycle generates Prisma Client once.
RUN npm run build


# =========================
# STAGE 2 - PRODUCTION
# =========================
FROM node:24-alpine

WORKDIR /app

# Dependencias de producción + CLI de Prisma para migrate deploy en arranque
COPY package*.json ./

# Config y migraciones Prisma (Prisma 7 usa prisma.config.ts)
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev

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
