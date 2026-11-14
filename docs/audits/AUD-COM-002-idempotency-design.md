# Diseño acotado — AUD-COM-002

## Hallazgos y alcance

- **Sin protección de intención:** `POST /sales`, `POST /purchases`, `POST /customer-payments`, `POST /customer-payments/pay-to-account` y `POST /purchases/:id/debt/payments`. Todos pueden confirmar efectos de stock, caja o deuda y no tienen una clave persistida.
- **Riesgo por respuesta perdida:** `POST /sale-returns`, `POST /purchase-returns`, `PATCH .../settle` para ambos tipos de reembolso y `POST .../apply-credit`. La creación puede dejar borradores duplicados y las liquidaciones/aplicaciones parciales aceptan más de una operación legítima, por lo que un retry idéntico puede repetir el efecto.
- **Protección de estado existente:** confirmar una devolución y anular un pago/operación bloquean o rechazan el segundo cambio de estado; no duplican los efectos financieros/de inventario. Se mantienen sin clave en este bloque, aunque un retry puede recibir conflicto en lugar de recuperar el cuerpo HTTP original.

## Diseño elegido

- Header `Idempotency-Key`, limitado a 128 caracteres ASCII visibles; namespace único por `tenantId + operation + key`.
- Tabla PostgreSQL aditiva con hash SHA-256 del cuerpo canónico y referencias tipadas a uno o varios recursos. No persiste cuerpos de solicitudes ni snapshots de PII/importes.
- Insertar la clave con `ON CONFLICT DO NOTHING` mediante `createMany(skipDuplicates)` dentro de la misma transacción comercial. El índice único serializa instancias concurrentes; el perdedor lee el resultado ya confirmado, compara el hash y devuelve conflicto si cambió el contenido. Si el dueño revierte, el retry puede reclamar la clave.
- Al confirmar, guardar IDs tipados y reconstruir la respuesta consultando recursos por tenant. No almacenar secretos ni una copia de la respuesta financiera.
- Claves permanentes mientras exista el tenant; sin caducidad que permita duplicar una operación histórica. Sin cambios ni borrados de datos comerciales históricos.
- El header será **opcional temporalmente** en backend para no romper clientes antiguos; solo las solicitudes con clave nueva quedan protegidas. Frontend actualizado genera y persiste una clave por intención en `sessionStorage`, aislada por usuario/tenant/operación, y mantiene un hash local para impedir reusar la clave con contenido editado. En una respuesta incierta, se puede reenviar el mismo contenido con la misma clave; éxito limpia la clave y la siguiente intención genera otra.

## Compatibilidad y seguridad

La autenticación, roles y guards actuales se ejecutan antes de cada retry; la recuperación del recurso se filtra por tenant. El refresh de access token reutiliza el mismo `RequestInit`, por lo que conserva `Idempotency-Key`. El logout público del Bloque 3 recibe únicamente refresh token bearer; se limitará por IP, no registra el body y solo recorre la cadena vinculada al hash presentado.

## Riesgos aceptados

Clientes antiguos o llamadas directas sin header siguen sin idempotencia durante la transición. Las respuestas repetidas reconstruyen el recurso actual por ID, no conservan un snapshot HTTP histórico después de cambios posteriores del recurso. Las claves se retienen sin vencimiento para priorizar no duplicar finanzas; requerirán política futura de archivo/retención si el volumen crece.

## Implementación y estado de validación

- Modelo `IdempotencyRecord` y migración aditiva `20261114010000_add_idempotency_records`.
- Servicio común `src/common/idempotency.ts`: hash canónico, validación de clave, reclamo con índice único y referencias tipadas; creación y efectos comerciales comparten transacción.
- Endpoints protegidos: ventas, compras, pagos cliente (individual/FIFO), pagos de deuda proveedor, creación de devoluciones, recibos parciales de reembolso y aplicaciones de crédito proveedor.
- Frontend persistente de intención por usuario/tenant para venta, compra, pagos de deuda proveedor y devoluciones/finanzas visibles. Las fechas generadas para reintentos se estabilizan mientras la intención esté pendiente.
- Replay ejecuta auth/roles antes de consultar el recurso; toda reconstrucción filtra por tenant. Los fallos de negocio antes de la transacción vuelven a buscar un resultado concurrente ya confirmado.
- Prueba PostgreSQL fuerza dos INSERT concurrentes a esperar en el índice único observado por `pg_stat_activity`; solo se confirma una venta, movimiento de stock y efecto de caja.
- Validación: build backend/frontend, TypeScript frontend, Prisma validate, suites unitarias backend y de autenticación frontend, migraciones completas y suite PostgreSQL aislada.
