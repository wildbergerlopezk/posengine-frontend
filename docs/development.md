# Desarrollo y validación de PosEngine

## Requisitos

- Node.js `24.15.0` (`.node-version`; engines `24.x` en frontend y backend).
- npm incluido con Node.js.
- PostgreSQL 16 aislado solo para la suite de integración.

## Frontend

```sh
cd posengine-web
npm ci
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

## Backend

```sh
cd posengine-backend
npm ci
npm run prisma:generate
npm run prisma:validate
npm run test:unit -- --runInBand
npm run build:compiled
npm audit --omit=dev
```

`npm run build` genera Prisma Client mediante `prebuild`; `npm test` lo genera mediante `pretest`. En CI se genera una sola vez y después se usan `test:unit` y `build:compiled`. Generar el cliente no aplica migraciones. `npm run db:migrate:deploy` es un paso explícito que debe apuntar únicamente a una base aislada cuando se ejecute durante pruebas.

## Integración PostgreSQL

La prueba `test/sales-postgres.integration.cjs` solo acepta `127.0.0.1:55439/posengine_sales_test`. Levantar una instancia efímera PostgreSQL 16 con esas coordenadas, exportar `DATABASE_URL` con credenciales sintéticas, aplicar primero `npm run db:migrate:deploy` y compilar `dist` antes de `npm run test:postgres`. La prueba verifica el host, puerto y nombre exactos y se niega a ejecutarse para otra base.

No apuntar estas instrucciones a producción, Supabase ni a una base habitual del comercio.
