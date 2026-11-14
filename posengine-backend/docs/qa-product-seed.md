# Seed local de productos QA

Este seed crea cien productos ficticios identificados con SKU `QA-PROD-001` a `QA-PROD-100`, diez categorías y sus subcategorías `QA`. Usa el tenant activo cuando hay uno solo; si hay varios, requiere `QA_SEED_TENANT_ID`.

## Destino y seguridad

El script solo admite una URL de base loopback, el nombre de base `posengine`, un PostgreSQL primario y migraciones aplicadas. También exige confirmar explícitamente ambos valores de destino. No cambia el esquema ni crea ventas, compras, pagos, sesiones de caja o deudas. El stock inicial se registra mediante `StockMovementService.registerInitial`.

Antes de sembrar, verificar que `.env` del backend siga apuntando a la instancia local de desarrollo esperada. No usar estos comandos con un túnel hacia una base remota. En la verificación de esta entrega, el backend y PostgreSQL eran procesos locales y la base `posengine` tenía las migraciones aplicadas.

## Ejecutar

Desde `posengine-backend`:

```bash
QA_SEED_ALLOW_LOCAL=YES QA_SEED_ALLOW_DATABASE=posengine npm run db:seed:qa-products
```

El seed es idempotente: no sobrescribe productos existentes. Si encuentra el mismo SKU con datos que no identifica como propios, se detiene.

## Limpiar

```bash
QA_SEED_ALLOW_LOCAL=YES QA_SEED_ALLOW_DATABASE=posengine npm run db:seed:qa-products:cleanup
```

La limpieza solo considera SKU QA y la descripción de marca del seed. Se bloquea si esos productos tienen referencias de ventas, compras o devoluciones, o movimientos distintos del inicial. En ese caso conserva los productos y los registros comerciales para evitar borrar historial.

No incluye imágenes ni modifica productos previos del tenant.
