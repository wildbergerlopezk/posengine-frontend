#!/bin/sh
set -e
echo "Aplicando migraciones de Prisma..."
npx prisma migrate deploy
exec node dist/src/main.js
