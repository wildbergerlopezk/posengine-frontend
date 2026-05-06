# Configuracion Docker (sin hardcode)

Esta guia explica como configurar el entorno Docker usando variables en `.env` para evitar valores hardcodeados en `docker-compose.yml`.

## 1) Crear archivo de entorno

Desde la raiz del proyecto:

```bash
cp .env.example .env
```

Luego edita `.env` y define al menos:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`

El resto ya tiene defaults razonables.

## 2) Levantar contenedores

```bash
docker compose up -d
```

Servicios:

- Backend API: `http://127.0.0.1:${BACKEND_PORT}` (default `3005`)
- Nginx uploads: `http://127.0.0.1:${NGINX_PORT}` (default `3006`)
- PostgreSQL host port: `${POSTGRES_PORT}` (default `5433`)

## 3) Variables usadas en docker-compose

`docker-compose.yml` usa variables para:

- Imagenes y nombres (`POSTGRES_IMAGE`, `BACKEND_IMAGE`, `NGINX_IMAGE`, etc.)
- Credenciales de BD (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)
- Config backend (`JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `NODE_ENV`)
- Puertos (`POSTGRES_PORT`, `BACKEND_PORT`, `NGINX_PORT`)

La `DATABASE_URL` del backend se compone automaticamente con esas variables:

`postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`

## 4) Relacion con Dockerfile y entrypoint (backend)

Archivos relevantes:

- `posengine-backend/Dockerfile`
- `posengine-backend/docker-entrypoint.sh`

Comportamiento:

1. El `Dockerfile` compila NestJS en una etapa de build.
2. La imagen final arranca con `docker-entrypoint.sh`.
3. El entrypoint ejecuta `npx prisma migrate deploy`.
4. Luego inicia la app con `node dist/src/main.js`.

Las variables de entorno (`DATABASE_URL`, `JWT_SECRET`, etc.) no se hardcodean en la imagen: se inyectan en runtime desde `docker-compose.yml` y `.env`.

## 5) Frontend web / Tauri

Para el frontend exportado por Next (`posengine-web`), crea:

- `posengine-web/.env.local`

Con:

```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3005
```

Luego:

```bash
cd posengine-web
npm run build
```

Y para desktop:

```bash
cd ../posengine-desktop
npm run build
```

