# PosEngine — Auditoría de arquitectura, seguridad y preproducción

- **Fecha:** 2026-11-13
- **Checkout:** `codex/sales-stabilization`
- **Commit auditado:** `026c062888611f53b8385781b0a4bc7d6dea1061`
**Alcance:** revisión estática del backend NestJS/Prisma, frontend Next.js, esquema y migraciones, configuración de release y diferencias locales. No se modificó código de aplicación ni se accedió a producción o a la base habitual.

## Resumen ejecutivo

**Evaluación inicial del 2026-11-13: 42/100 — bloqueada para despliegue público en ese momento.** La calificación expresa prioridad de ingeniería, no una certificación, y no se recalculó tras los bloques posteriores.

La puntuación corresponde únicamente al estado inicial del 2026-11-13. Al cierre local del 2026-11-14, los Bloques 1–6 y AUD-COM-001 están implementados y validados localmente; la integración remota de CI y la preparación/despliegue seguro del Bloque 7 siguen pendientes. Este seguimiento no certifica que el entorno de producción esté listo.

### Seguimiento del Bloque 1 — 2026-11-13

AUD-SEC-001 y AUD-SEC-007 quedaron **resueltos en el checkout local** con la corrección descrita en sus entradas. No se modificó la calificación inicial ni se trabajó en los demás bloques. Verificación de este seguimiento: suite backend completa (25 suites, 147 pruebas), Prisma validate, build backend y `git diff --check`; no se necesitó migración ni prueba PostgreSQL porque no hubo cambios de esquema.

Los cinco problemas de mayor impacto son:

1. **SSRF desde el generador de comprobantes (resuelto en el seguimiento del Bloque 1):** el generador ahora acepta solo referencias de almacenamiento de PosEngine bajo el tenant autenticado; no sigue redirecciones y acota tiempo, bytes y decodificación.
2. **Pérdida de stock con compras simultáneas (resuelta en el Bloque 2 reducido):** las compras ahora incrementan el stock con una actualización SQL atómica filtrada por producto y tenant; el movimiento usa el valor devuelto por PostgreSQL.
3. **Refresh token de un solo uso no serializado (resuelto en el Bloque 3):** la rotación y el logout se serializan por usuario; la integración concurrente validó el claim y replay.
4. **Configuración Compose no conectada al frontend:** falta el archivo `nginx.conf` que Compose monta; Compose pasa `NEXT_PUBLIC_API_URL`, mientras el código lee `NEXT_PUBLIC_BACKEND_URL`, y las ocho capacidades comerciales tampoco se pasan al backend.
5. **Dependencias de producción con advisories críticos/altos (resuelto en el Bloque 5):** ambos proyectos reportan cero vulnerabilidades con `npm audit --omit=dev`; quedan avisos moderados/bajos en tooling de desarrollo.

En la revisión inicial, el commit auditado era **reproducible en un checkout limpio** cuando se generaba primero el cliente Prisma. La lista de 25 elementos locales y la conclusión sobre ausencia de lectura cross-tenant describen esa revisión inicial; los cambios posteriores se documentan en los seguimientos fechados al final de este informe. No hay RLS ni claves foráneas compuestas que refuercen la frontera tenant en PostgreSQL.

## A. Correcciones obligatorias antes de producción

### AUD-SEC-001 — SSRF al generar comprobantes con URL de logo

- **Estado del seguimiento:** **Resuelto** (checkout local; 2026-11-13).
- **Severidad:** Alta.
- **Causa original:** el DTO aceptaba cualquier URL y el PDF ejecutaba `fetch()` directamente sobre ella, cargando la respuesta completa.
- **Solución:** `UploadService` emite URLs bajo `product-images/{tenantId}/{uuid}.webp`; valida origen, bucket, namespace, UUID, tipo real de imagen, 5 MiB y 25 MP. Para el PDF, construye la URL solo desde el origen Supabase configurado, usa `redirect: 'error'`, timeout de 5 s, valida `image/webp`, limita la lectura a 5 MiB y decodifica a PNG de hasta 800×800. URL inválida, archivo faltante o fallo de almacenamiento solo produce una advertencia y el PDF se genera sin logo. La actualización de empresa rechaza referencias nuevas externas o de otro tenant; una URL histórica sin cambios puede conservarse en el registro, pero no se carga en el PDF.
- **Pruebas:** casos mockeados para localhost/loopback, red privada, link-local/metadata, esquema no permitido, otro tenant, redirección, timeout, tamaño excedido, contenido inválido, logo válido, logo faltante y PDF sin logo. Ninguna prueba contacta destinos internos reales.
- **Archivos principales:** `posengine-backend/src/modules/upload/upload.service.ts`, `posengine-backend/src/modules/company/company.service.ts`, `posengine-backend/src/modules/company/dto/create-company.dto.ts`, `posengine-backend/src/modules/internal-receipts/internal-receipt-pdf.service.ts`.
- **Compatibilidad histórica:** logos externos y objetos antiguos sin namespace no se migran ni descargan; permanecen almacenados, se omiten en PDF hasta ser reemplazados por un upload nuevo. No se descargó ni movió contenido histórico.
- **Riesgo residual:** el bucket `product-images` y `/uploads/` local siguen siendo públicos para que el frontend pueda mostrar imágenes. La corrección protege el uso de referencias desde la API/PDF y el borrado por tenant; no convierte imágenes públicas ya conocidas en archivos privados.
- **Bloqueaba despliegue:** sí; riesgo remediado en el seguimiento local. Revalidar en el checklist de release.

### AUD-COM-001 — Compras concurrentes pueden perder incrementos de stock

- **Estado del seguimiento:** **Resuelto** (checkout local; 2026-11-13).
- **Severidad:** Alta.
- **Causa original:** la compra leía stock, calculaba un valor absoluto en memoria y escribía ese valor sin `tenantId`; el kardex usaba ese mismo dato potencialmente obsoleto.
- **Corrección aplicada:** se eliminó la lectura previa/`stockMap` y la actualización absoluta. Después de crear cada `PurchaseItem`, `PurchaseService.create` llama a `StockMovementService.registerPurchase` con el cliente transaccional. Este hace `UPDATE products SET stock = stock + quantity WHERE id = productId AND tenantId = tenantId RETURNING stock`, calcula `before = after - quantity` desde la fila resultante y crea el movimiento en la misma transacción. Si el producto no pertenece al tenant no se actualiza ni se inserta movimiento. Sin cambios de esquema.
- **Pruebas PostgreSQL:** dos compras al mismo producto y compra frente a venta se bloquearon deliberadamente con un lock de fila; antes de liberar el lock, la prueba confirmó en `pg_stat_activity` que ambos comandos de stock estaban esperando. Se comprobaron stock final, cadena `before/after`, rollback inducido después del movimiento, aislamiento entre tenants y compras CASH/CREDIT. Los fixtures crean una segunda sesión de caja solo para que la contención de la caja no oculte la contención de inventario; no se implementaron múltiples cajas ni operadores.
- **Validación:** suite backend 25/25 suites y 148/148 pruebas; integración PostgreSQL 16 aislada 91/91; build backend y `git diff --check` pasaron.
- **Riesgo residual:** la fila de movimientos mantiene el timestamp transaccional existente; este cambio no altera la semántica de ordenamiento por `createdAt` ni refactoriza el historial global.
- **Bloqueaba despliegue:** sí; riesgo remediado en el seguimiento local. Revalidar en el checklist de release.

### AUD-SEC-002 — Rotación de refresh token permite dos descendientes concurrentes

- **Estado del seguimiento:** **Resuelto localmente** (Bloque 3; 2026-11-14).
- **Severidad:** Alta.
- **Evidencia:** `refresh()` leía el token activo y después actualizaba por `id` sin condición `revokedAt: null`, seguido de la creación del nuevo token.
- **Problema y causa:** dos solicitudes concurrentes pueden leer el token como activo; las dos actualizan la misma fila y las dos crean tokens nuevos. El segundo update no detecta que la primera solicitud ya lo rotó. Se deshace así la propiedad de uso único y el detector de replay no se activa entre ambas solicitudes.
- **Corrección aplicada:** refresh y logout toman un lock transaccional de la fila de usuario para serializar operaciones de sesión. Refresh vuelve a leer el token tras el lock y lo reclama con `updateMany` condicionado por `id`, usuario, hash, `revokedAt: null` y expiración vigente; solo con `count === 1` crea el sucesor en la misma transacción. Si el insert falla, PostgreSQL revierte también el claim. Sin cambios Prisma ni migraciones.
- **Semántica de replay:** un token revocado o expirado devuelve 401 y no emite un sucesor. Reutilizar un token rotado no cierra otras sesiones ni revoca el sucesor; solo deniega el replay, evitando desconexiones amplias por carreras normales.
- **Logout y frontend:** logout presenta el refresh token de la sesión sobre el endpoint público de cierre, y el backend revoca esa cadena de reemplazos bajo el mismo lock que refresh. Así, si la rotación gana, logout alcanza el sucesor; si logout gana, refresh no crea uno. El frontend conserva single-flight, detecta access tokens ya renovados, y descarta respuestas tardías si la sesión local fue cerrada. El logout sigue dejando intacta la autorización existente del dispositivo PIN.
- **Archivos afectados:** `posengine-backend/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `services/refresh-token.service.ts`, `services/logout.service.ts`, sus pruebas unitarias y `test/sales-postgres.integration.cjs`; `posengine-web/src/shared/api/apiClient.ts`, `src/shared/components/Sidebar/Sidebar.tsx`, `src/features/auth/utils/refresh-coordinator.ts` y `test/auth-login.test.mjs`.
- **Validación:** integración PostgreSQL 16 desechable: **96/96**, incluyendo conexiones solapadas verificadas por waiters en `pg_stat_activity`, replay, expiración/revocación, logout-refresh, rollback inducido y login convencional → logout → PIN autorizado. Suite backend: **26 suites, 152/152**; frontend auth: **8/8**; TypeScript frontend, builds de backend y frontend, `prisma validate` y `git diff --check`: pasaron. Sin migraciones.
- **Riesgo residual:** el endpoint público de logout requiere el refresh token bearer para identificar la cadena; no se migraron credenciales a cookies HttpOnly. Pestañas con una copia independiente de `sessionStorage` no comparten el single-flight: si una pestaña consume el refresh primero, la otra recibirá 401 y deberá volver a autenticarse, pero el backend no revoca la sesión ganadora ni sesiones ajenas. Logout carga los tokens del usuario una vez y recorre la cadena en memoria antes de revocar solo sus filas.
- **Bloquea despliegue:** remediado localmente; repetir validación en CI y checklist de release.

### AUD-SEC-003 — Superficie de producción contiene dependencias vulnerables

- **Estado del Bloque 5:** **Resuelto en el checkout local** (2026-11-14); no se hizo commit ni despliegue.
- **Severidad original:** Alta (el audit de npm marcaba una dependencia directa de frontend como crítica; el impacto concreto dependía de las rutas afectadas).
- **Evidencia:** el checkout limpio instaló `next@16.1.6`, `@nestjs/platform-express@11.1.19`, `multer@2.1.1` y `sharp@0.34.5`. `npm audit --omit=dev` reportó frontend **1 crítica, 6 altas y 1 moderada**; backend **2 críticas, 13 altas y 5 moderadas**. Entre los avisos directos están Next.js (<16.1.7 y otros rangos de advisories), Multer (<2.3/2.5 según el advisory) y Sharp (<0.35.5). El endpoint de upload usa `FileInterceptor` (`upload.controller.ts:27-29`) y el bucket es procesado por Sharp (`upload.service.ts:27-67`).
- **Problema y causa:** los lockfiles congelan versiones afectadas según el registry audit consultado el 2026-11-13. Hay advisories de DoS en multipart y procesamiento de imágenes, además de avisos de Next.js. Algunos avisos transitivos (DOMPurify y proxy-addr) requieren verificación de aplicabilidad en las rutas usadas; no se reportan como exploits confirmados de PosEngine.
- **Consecuencia:** DoS o exposición ante entradas remotas en componentes desplegados. Next corre en producción y Multer/Sharp procesan uploads autenticados; el rol autenticado no elimina el riesgo de abuso por una cuenta comprometida.
- **Corrección aplicada:** Next.js 16.1.6 → 16.4.6 y Zod 3.25.76 → 4.6.7 (no hay imports directos de Zod/resolver en el frontend); dependencias transitivas frontend actualizadas dentro de rangos compatibles: `baseline-browser-mapping` 2.10.0 → 2.11.37, `lodash` 4.17.23 → 4.18.1, `nanoid` 3.3.11 → 3.3.20, PostCSS 8.5.6 → 8.5.23, Sharp opcional 0.34.5 → 0.35.5 y `source-map-js` 1.2.1 → 1.2.2. En backend: `@nestjs/platform-express` 11.1.19 → 11.2.10 (misma rama mayor, fija Multer 2.5.0), `@nestjs/swagger` 11.3.0 → 11.4.8 (usa js-yaml 5.5.0), `@prisma/adapter-pg`/`@prisma/client`/CLI 7.7.0 → 7.10.1 por advisories de Prisma, Nodemailer 9.0.3 → 10.5.0 y Sharp 0.34.5 → 0.35.5. También se actualizaron lock-only transitivas: DOMPurify 3.4.12 → 3.4.17, `proxy-addr` 2.0.7 → 2.0.8, `body-parser` 2.2.2 → 2.4.0, `deepmerge-ts` 7.1.5 → 8.0.2, `fast-uri` 3.1.0 → 3.1.9, Hono y `@hono/node-server` fuera del árbol fijado, `mysql2` 3.15.3 → 3.24.4, `qs` 6.15.1 → 6.17.1, `valibot` 1.2.0 → 1.4.2 y `ws` 8.20.0 → 8.23.0. No se usaron overrides ni `npm audit fix --force`.
- **Comparación del audit de producción (`npm audit --omit=dev`, 2026-11-14):** frontend **1 crítica, 6 altas, 1 moderada → 0/0/0**; backend **2 críticas, 13 altas, 5 moderadas → 0/0/0**. Sin advisories críticos o altos restantes en la instalación de producción. El audit completo (incluye tooling de desarrollo) quedó frontend **0/0/0** y backend **1 crítica, 3 altas, 19 moderadas, 3 bajas → 0 críticas, 0 altas, 18 moderadas, 3 bajas** después de actualizar dentro de rango `brace-expansion`, Browserslist, `form-data` y Handlebars. Los 21 avisos restantes del backend completo son dependencias de desarrollo; no se reportan como parte del árbol de producción y no se forzaron upgrades de tooling sin necesidad.
- **Advisories graves corregidos/aplicabilidad:** Next.js ejecuta en producción y se actualizó por múltiples advisories del rango 16.1.6; Multer recibe multipart y Sharp decodifica imágenes, por lo que ambos se corrigieron aunque la carga requiere autorización; `proxy-addr` se actualizó por IP spoofing; Nodemailer por validación de destinatarios y DoS; Prisma CLI/config/adapter se actualizaron por avisos del paquete. DOMPurify era opcional en jsPDF y se actualizó igualmente. Se inspeccionaron rangos y rutas mediante los informes JSON/árbol npm; la severidad de npm no se interpretó como explotación confirmada.
- **Archivos afectados por el bloque:** `posengine-web/package.json`, `posengine-web/package-lock.json`, `posengine-web/app/dashboard/clients/payments/page.tsx`, `posengine-backend/package.json`, `posengine-backend/package-lock.json` y este informe. El formulario activo de cobro a cuenta ahora envía `Idempotency-Key` y conserva la intención ante resultado incierto; no se cambió la API/backend.
- **Validación:** `npm ci` en frontend y backend con los lockfiles finales; frontend TypeScript, Node tests **9/9**, build Next; backend **26 suites/152 pruebas**, build Nest, `prisma generate`, `prisma validate`; PostgreSQL 16 desechable con **103/103** pruebas e instalación de las 51 migraciones; CORS preflight reflejó `idempotency-key`; uploads y PDF quedaron cubiertos en la suite backend; `npm audit --omit=dev` en ambos proyectos sin vulnerabilidades; `git diff --check` pasó tras editar este informe.
- **Riesgo de regresión:** medio por Next y Prisma dentro de su versión mayor, Nodemailer 9→10 y Sharp 0.34→0.35. Los changelogs indican que Nodemailer 10 exige Node 20+ y Sharp 0.35 exige Node 20.9+, además de retirar APIs deprecated; el código de PosEngine usa `createTransport`/`sendMail` y no usa las APIs retiradas de Sharp. Los Dockerfiles usan la etiqueta móvil `node:20-alpine`; no se inspeccionó la imagen de producción final. Se validaron TypeScript, builds, imágenes/PDF mediante tests, migraciones y flujos PostgreSQL. Zod 3→4 fue posible sin migrar código porque no hay imports de Zod en el frontend.
- **Bloquea despliegue:** el hallazgo de dependencias de producción queda remediado en el checkout local. Los avisos moderados/bajos de herramientas de desarrollo y la advertencia de `pg` se mantienen como seguimiento, no se suprimieron.
- **Referencias de advisories:** [Next.js RCE vía SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Multer DoS multipart](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm), [Sharp/libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [proxy-addr IP spoofing](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [DOMPurify XSS](https://github.com/advisories/GHSA-55q2-fjhq-7xh7), [Zod DoS](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

#### Seguimiento de estabilidad y Bloque 4

- El preflight CORS simulado para el origen permitido y `Authorization, Content-Type, Idempotency-Key` devolvió 204 y reflejó la cabecera solicitada, coherente con `cors` cuando no se fija `allowedHeaders`.
- El frontend actual tenía un formulario operativo en `app/dashboard/clients/payments/page.tsx` para `POST /customer-payments/pay-to-account`; ese formulario no enviaba clave. Ya utiliza `prepareIdempotencyKey("CUSTOMER_PAY_TO_ACCOUNT", ...)`, conserva la clave en `sessionStorage` hasta éxito o error cliente definitivo, y la reutiliza para reintentos con el mismo contenido. Reutilizarla con contenido distinto genera un conflicto visible. El endpoint de anulación de pago no recibe clave; la operación rechaza un pago ya anulado y no repite el efecto, pero no forma parte del mecanismo de idempotencia del Bloque 4.
- Compatibilidad transitoria: el backend declara opcional `Idempotency-Key`; clientes anteriores pueden seguir enviando operaciones sin esa garantía. Un frontend actualizado contra un backend anterior también seguirá procesando, pero ese backend no hará replay idempotente. El contrato de login/refresh sigue usando JSON con `refreshToken` y respuesta `accessToken`/`refreshToken`; el frontend previo ya enviaba el token al endpoint logout, por lo que ese cambio de autenticación conserva compatibilidad con ese cliente. Mantener versiones coordinadas antes de habilitar reintentos como garantía operativa.
- La prueba de actualización de los datos históricos desde el esquema inmediatamente anterior y el ensayo de restauración siguen pendientes del Bloque 7; la validación actual aplicó las 51 migraciones a PostgreSQL aislado vacío.
- La integración dejó una advertencia deprecada de `pg@8.22.0` dentro de `PgTransaction.performIO` de `@prisma/adapter-pg@7.10.1`, cuando una consulta llega mientras el mismo `pg.Client` aún tiene una consulta activa/en cola. No hay `client.query()` directo en el servicio de aplicación responsable y los 103 casos concluyeron; el driver encola/serializa las consultas. No se añadió un lock global ni se tocó el flujo comercial. Seguimiento: identificar/reproducir con Prisma/pg upstream antes de subir a pg 9, porque el aviso anuncia retiro futuro de la cola.
- **Referencias de advisories:** [Next.js HTTP request smuggling](https://github.com/advisories/GHSA-ggv3-7p47-pfv8), [Multer DoS y límites multipart](https://github.com/advisories/GHSA-qvfw-j98x-7q72), [Sharp/libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj).

### AUD-DEPLOY-001 — Compose no contiene una ruta de API reproducible ni habilita las capacidades

- **Severidad:** Alta.
- **Evidencia:** Compose monta `./nginx.conf` (`docker-compose.yml:64-66`), pero no hay `nginx.conf` en el commit ni en el checkout limpio. Compose pasa `NEXT_PUBLIC_API_URL` (`:45-52`), mientras el frontend consume `NEXT_PUBLIC_BACKEND_URL` (`posengine-web/src/shared/config/api.ts:1-29`). El Dockerfile compila Next sin un argumento/configuración de build para esa variable (`posengine-web/Dockerfile:8-13`). En LAN el fallback llama al host por el puerto 3005 (`api.ts:12-16`), pero Compose solo hace `expose` de backend y no publica ese puerto (`docker-compose.yml:27-35`). Además, Compose no pasa ninguna de las ocho variables `POSENGINE_ENABLE_*`; la política deja cada capacidad desactivada salvo que su variable sea exactamente `true` (`commercial-operation-policy.ts:13-21,48-50`).
- **Problema y causa:** el archivo de proxy falta y los nombres/tiempos de configuración no coinciden. En la configuración versionada no queda demostrado que el navegador pueda llegar al backend; los flujos de devoluciones/anulaciones quedan deshabilitados por defecto y no pueden habilitarse mediante el `.env` de Compose.
- **Consecuencia:** despliegue Compose puede fallar al montar Nginx o servir el frontend sin API; las ocho capacidades comerciales aparecen deshabilitadas aunque estén definidas en el `.env` del host.
- **Corrección propuesta:** agregar/proveer el proxy versionado, definir una sola variable de API y pasarla durante el build de Next, documentar la ruta de API para localhost/LAN, y mapear explícitamente las ocho capacidades a backend con defaults conservadores. Mantener apagadas hasta terminar controles de datos autorizados.
- **Archivos afectados:** `docker-compose.yml`, `posengine-web/Dockerfile`, `posengine-web/src/shared/config/api.ts`, configuración Nginx pendiente.
- **Riesgo de regresión:** medio; las rutas frontend deben probarse en modo mismo origen y LAN.
- **Pruebas necesarias:** `docker compose config`, construir imágenes limpias, smoke test de login/API desde browser local y LAN, comprobar los ocho estados de capacidades sin/ con flags. No iniciar producción para probar.
- **Bloquea despliegue:** sí.

### AUD-DEPLOY-002 — PostgreSQL se publica en todas las interfaces del host

- **Severidad:** Alta, condicionada a firewall/topología externa no inspeccionada.
- **Evidencia:** `docker-compose.yml:11-12` publica `${POSTGRES_PORT:-5433}:5432` sin prefijo `127.0.0.1` ni necesidad de acceso desde fuera de la red Docker.
- **Problema y causa:** Docker publica el puerto en las interfaces del host de forma predeterminada. El repositorio no especifica reglas de firewall ni lista de redes administrativas permitidas.
- **Consecuencia:** si el servidor es alcanzable desde Internet/LAN y el firewall lo permite, PostgreSQL queda expuesto a intentos directos de autenticación y explotación de credenciales.
- **Corrección propuesta:** quitar el mapeo de puerto para producción (backend ya comparte red privada Docker) o limitarlo explícitamente a loopback para mantenimiento; documentar firewall y rotación de credenciales.
- **Archivos afectados:** `docker-compose.yml`.
- **Riesgo de regresión:** bajo si se conserva acceso operativo mediante VPN/túnel.
- **Pruebas necesarias:** inspección de puertos publicados y escaneo desde una red externa autorizada al servidor de staging, nunca a producción durante esta auditoría.
- **Bloquea despliegue:** sí hasta confirmar que el puerto no es público.

### AUD-DEPLOY-003 — El contexto de build del frontend incluye configuración local ignorada

- **Severidad:** Media/condicional; no se leyó el contenido del archivo.
- **Evidencia inicial:** existía un `posengine-web/.env.local` local (ignorado por Git); no existía `posengine-web/.dockerignore`, y `posengine-web/Dockerfile` hace `COPY . .` antes de compilar. Las variables `NEXT_PUBLIC_*` que se lean durante Next build pueden quedar incorporadas al bundle.
- **Problema y causa:** el build de Docker incorpora configuración fuera del commit al contexto. No se verificó si ese archivo contiene solamente una URL pública o algún valor sensible.
- **Consecuencia:** la build local puede comportarse distinto al checkout limpio y, si contiene valores sensibles usados durante la compilación, el artefacto podría exponerlos.
- **Seguimiento Bloque 6:** ambos contextos Docker ahora excluyen `.env*`, `.next`/artefactos, dependencias, Git, dumps y QA mock. No se leyó ningún archivo de entorno; build de imagen y auditoría del contexto final quedan pendientes del Bloque 7.
- **Archivos afectados:** `posengine-web/Dockerfile`, `.dockerignore` pendiente.
- **Riesgo de regresión:** bajo; documentar qué variable de URL es pública y necesaria en build.
- **Pruebas necesarias:** build de imagen con `.env.local` sintético, verificar que el archivo no forma parte del contexto/final image y que la URL pública se configura de forma explícita.
- **Bloquea despliegue:** no confirmado como fuga; resolver/excluir el archivo antes del build de release.

### AUD-COM-002 — Idempotencia de operaciones comerciales

- **Estado:** Corregido localmente; pendiente de revisión antes del próximo commit.
- **Causa:** las transacciones aseguraban atomicidad interna, pero cada repetición de la misma solicitud creaba una operación nueva.
- **Solución:** nuevo `Idempotency-Key` opcional por compatibilidad, único por tenant/operación/clave. El hash canónico del payload y las referencias de resultado se guardan dentro de la misma transacción comercial; un replay idéntico reconstruye el recurso con filtro de tenant y un payload distinto recibe conflicto. El rollback elimina también la clave reclamada. Las claves no expiran mientras exista el tenant.
- **Cobertura backend:** venta, compra, pago de cliente, pago FIFO a cuenta, pago de deuda de proveedor, creación de devoluciones, abonos parciales de reembolso y aplicación de crédito de proveedor. Las transiciones de estado con guardas existentes permanecen intactas.
- **Cobertura frontend:** se crea y conserva una clave en `sessionStorage` por usuario/tenant/intención en ventas, compras, pagos de deuda de proveedor y flujos visibles de devolución/liquidación; reintentos con contenido cambiado se bloquean hasta que el usuario resuelva la intención pendiente.
- **Persistencia:** migración aditiva `20261114010000_add_idempotency_records`; no persiste cuerpo de solicitud, tokens ni snapshots financieros.
- **Validación del Bloque 5 (histórica):** 152/152 pruebas unitarias backend, 103/103 verificaciones PostgreSQL aislado (incluida espera concurrente observada en el índice único y replay de pagos/devoluciones), 9/9 pruebas de autenticación/idempotencia en el archivo auth, TypeScript frontend, build backend/frontend, `prisma validate`, migraciones aisladas y `git diff --check` aprobados. Esa suite frontend parcial no representaba el total.
- **Limitaciones:** clientes antiguos que omitan la cabecera y llamadas directas sin clave siguen siendo repetibles; la respuesta reproducida refleja el recurso actual, no un snapshot HTTP original. El formulario activo `/dashboard/clients/payments` consume `POST /customer-payments/pay-to-account` y envía `Idempotency-Key` desde el Bloque 5; véase el seguimiento actualizado de AUD-COM-002 al final del informe.
- **Bloquea despliegue:** sí hasta desplegar la migración y confirmar que todos los clientes operativos envían la cabecera.

### AUD-REL-001 — No hay runbook verificable de backup, restauración y despliegue de migraciones

- **Severidad:** Media (prerrequisito operativo antes de migrar datos reales).
- **Evidencia:** backend ejecuta `prisma migrate deploy` al arrancar (`posengine-backend/docker-entrypoint.sh:3-5`); no se encontró procedimiento versionado de backup/restauración o recuperación en `README`, docs, Docker y workflows. Hay un SQL de diagnósticos comerciales read-only, pero no es un plan de restauración.
- **Problema y causa:** no hay evidencia repetible de restauración antes de aplicar 50 migraciones ni de recuperación si falla la migración o el nuevo código. Varias migraciones históricas descartan columnas/tablas; las migraciones nuevas no tienen un rollback simétrico completo.
- **Consecuencia:** una copia sin probar o una migración parcialmente aplicada puede alargar una interrupción o impedir recuperar estados financieros coherentes.
- **Corrección propuesta:** antes de producción, definir backup consistente, ubicación cifrada/retención, restauración en entorno aislado, ventana/locks esperados, responsable, punto de no retorno, plan de forward-fix y evidencia de validaciones de datos preexistentes. No considerar `rollback.sql` parcial como recuperación general.
- **Archivos afectados:** documentación operativa pendiente, `docker-entrypoint.sh`, conjunto de migraciones.
- **Riesgo de regresión:** bajo al documentar; alto si se intenta rollback a ciegas.
- **Pruebas necesarias:** restaurar una copia autorizada de datos anonimizados en PostgreSQL aislado, desplegar migraciones, ejecutar invariantes y ensayar recuperación.
- **Bloquea despliegue:** sí para migraciones/datos reales hasta probar restore y acordar ventana.

### AUD-REL-002 — Workflow de release apunta a una aplicación ausente y no valida backend

- **Severidad:** Alta si se usa el workflow de tags como gate de release.
- **Evidencia:** `.github/workflows/release.yml:42-44` ejecuta en `working-directory: posengine-desktop`, pero esa carpeta no existe en el commit. El único workflow hallado es ese; hace build web, luego abandona el flujo del backend y frontend de contenedores, y no ejecuta tests o validación Prisma (`:34-44`).
- **Problema y causa:** el pipeline parece obsoleto frente a este checkout y no funciona como gate de la release PosEngine backend/web.
- **Consecuencia:** un tag puede fallar antes de generar el artefacto desktop, mientras APIs, migraciones y pruebas no quedan validadas por CI.
- **Corrección propuesta:** decidir qué artefactos se liberan; actualizar o retirar el job desktop y agregar CI reproducible (`npm ci`, generación Prisma, tests, typecheck, build, schema/migrations) para los servicios realmente desplegados.
- **Archivos afectados:** `.github/workflows/release.yml` y workflows nuevos/actualizados.
- **Riesgo de regresión:** medio por secretos/firma de releases desktop y contrato de artefactos.
- **Pruebas necesarias:** ejecutar workflow en tag de prueba y verificar artefactos backend/frontend; no publicar release durante la auditoría.
- **Bloquea despliegue:** sí si se depende de este workflow como gate; si no se usa, reemplazarlo o documentar el pipeline alternativo.

## B. Refactorizaciones seguras y justificadas para esta release

### AUD-ARCH-001 — El build Next omite la validación de TypeScript

- **Severidad:** Media.
- **Evidencia:** `posengine-web/next.config.mjs:2-4` configura `typescript.ignoreBuildErrors: true`; el build de producción informa explícitamente que omite type validation. El workflow solo ejecuta `npm run build` (`release.yml:38-40`).
- **Problema/consecuencia:** una build verde por sí sola no prueba que el frontend compile con TypeScript. En esta auditoría `npx tsc --noEmit` sí pasó en el checkout limpio, pero no se ejecuta como gate versionado.
- **Corrección Bloque 6:** eliminada la omisión `ignoreBuildErrors`; se añade `npm run typecheck` (`tsc --noEmit`) y gate separado en CI antes del build. No es necesario dividir componentes para corregirlo.
- **Archivos:** `posengine-web/next.config.mjs`, workflow CI.
- **Pruebas:** introducir temporalmente un error de tipo en pipeline de prueba y confirmar que el job falla; luego ejecutar TSC y build.
- **Bloquea despliegue:** no por el estado actual comprobado; sí si la única validación disponible es `next build`.

### AUD-SEC-004 — El registro entrega sesión antes de verificar correo

- **Severidad:** Media; depende de si la verificación de correo es requisito de identidad del producto.
- **Evidencia:** registro crea `emailVerified: false`, envía verificación y aun así emite refresh/access tokens (`register.service.ts:70-87`). El login solo valida contraseña y cuenta activa (`login.service.ts:18-31`); JWT valida `active` y sesión, pero no rechaza `emailVerified: false` (`jwt.strategy.ts:38-59`).
- **Problema/consecuencia:** cualquier dirección sintácticamente válida puede crear tenant y usarlo sin demostrar control del buzón. Si el correo se usa para recuperación, contacto o identidad, el indicador no es una barrera de seguridad.
- **Corrección:** definir política explícita. Si la verificación debe bloquear acceso, no emitir sesión y validar también en backend para sesiones preexistentes; si solo es aviso, renombrar/documentar la semántica y añadir controles antiabuso de registro.
- **Riesgo:** medio por cuentas ya creadas; hacer una migración/flujo de recuperación cuidadosamente si se decide bloquear.
- **Pruebas:** registro no verificado, login directo, PIN, verificación, token antiguo después de cambio de política.
- **Bloquea despliegue:** confirmar intención antes de aceptar cuentas públicas; no se confirmó acceso entre tenants.

### AUD-SEC-005 — Los tokens bearer permanecen legibles por JavaScript

- **Severidad:** Media, riesgo preventivo y no XSS confirmado.
- **Evidencia:** el store persiste access y refresh tokens en `sessionStorage` (`posengine-web/src/features/auth/store/auth.store.ts:10-14,25-55`). El access token dura 15 minutos y el refresh token 7/30 días (`auth/constants/auth.constants.ts:1-6`). No se encontró configuración de CSP/headers de seguridad en `next.config.mjs` o `main.ts`.
- **Problema/consecuencia:** cualquier XSS ejecutable en el mismo origen puede leer el refresh token y obtener nuevas sesiones. No se encontró un sink `dangerouslySetInnerHTML` en los módulos revisados, por lo que no afirmo un XSS explotable actual.
- **Corrección:** priorizar CSP estricta/report-only y reducir scripts de terceros; evaluar refresh token HttpOnly/Secure/SameSite con protección CSRF solo si el modelo de despliegue lo permite. No hacer una migración global sin diseño de origen/CORS y logout.
- **Pruebas:** auditoría CSP en QA, renovación, CSRF, logout y PIN en navegador real.
- **Bloquea despliegue:** no por sí solo; elevar si se detecta XSS o scripts no confiables.

### AUD-SEC-006 — Revocar dispositivo PIN no revoca sesiones ya emitidas

- **Severidad:** Media/condicional.
- **Evidencia:** `revokeCurrentDevice` actualiza solo `quickPinDevice` (`quick-pin.service.ts:188-194`); `RefreshToken` no tiene relación con `quickPinDevice` (`prisma/models/refreshToken.prisma`). El endpoint de revocación ejecuta esa operación y borra la cookie (`auth.controller.ts:160-165`).
- **Problema/consecuencia:** el dispositivo queda impedido de volver a iniciar por PIN, pero una sesión que ese dispositivo obtuvo antes conserva su refresh token activo hasta logout/expiración. La revocación `logout-all` sí invalida ambos conjuntos; la revocación individual no permite identificar su sesión.
- **Corrección:** definir el contrato de “revocar dispositivo”. Si significa cerrar todas las sesiones de ese dispositivo, vincular refresh sessions con device ID y revocarlas juntas; si solo desautoriza PIN futuro, indicarlo claramente en UI y pruebas.
- **Pruebas:** dispositivo revocado intenta login PIN y refresh de una sesión ya iniciada; logout individual y logout-all.
- **Bloquea despliegue:** solo si el producto promete que revocar equivale a cerrar sesiones.

### AUD-COM-003 — Claves de capacidad provocan GET duplicados en historial/modales

- **Severidad:** Baja/Media.
- **Evidencia:** `useCommercialCapabilities` hace un `fetch` por instancia, sin caché compartida (`src/shared/hooks/useCommercialCapabilities.ts:30-56`). Hay llamadas independientes desde `PurchaseHistoryPage`, `PurchaseReturnModal`, `PurchaseReturnFinancePanel`, `SaleDetailModal` y `SaleReturnPanel`.
- **Problema/consecuencia:** al montar página y modal se repite `GET /commercial-operations/capabilities`; no es un fallo de seguridad y el volumen actual es pequeño.
- **Corrección Bloque 6:** caché compartida por ID de usuario + tenant, TTL 30 s y deduplicación in-flight. Logout, `setAuth` y refresh explícito invalidan la caché; las respuestas de error no se almacenan. La autorización sigue dependiendo del backend y se conserva el contrato de ocho capacidades. Hay prueba unitaria de deduplicación, aislamiento, TTL e invalidación de respuesta tardía.
- **Pruebas:** contar requests por carga de página, apertura/cierre de modal y cambio de token.
- **Bloquea despliegue:** no.

### AUD-PERF-001 — Búsqueda substring no tiene índice adecuado para catálogos grandes

- **Severidad:** Media, dependiente del tamaño del tenant.
- **Evidencia:** `ProductService` usa `contains` case-insensitive sobre nombre, SKU, barcode y descripción (`product.service.ts:199-205,232-245`). Los índices comprometidos de productos son índices simples por `tenantId`, categoría, subcategoría y proveedor (`20260813145417_add_database_indexes/migration.sql:34-44`); no hay índice trigram/GIN de texto en las migraciones revisadas.
- **Problema/consecuencia:** `contains` se traduce a substring/`ILIKE %x%`, que no aprovecha un B-tree convencional en el prefijo; el tenant puede terminar escaneando sus productos por tecla/búsqueda.
- **Corrección:** medir `EXPLAIN (ANALYZE, BUFFERS)` con un volumen anonimizado representativo; luego comparar `pg_trgm`/GIN o cambiar a búsqueda prefijo según UX. No añadir índices antes de medir y revisar coste de escritura.
- **Pruebas:** QA con catálogos de tamaño realista, búsquedas SKU/código de barras/nombre y paginación; publicar p50/p95 y plan.
- **Bloquea despliegue:** no con datos actuales desconocidos.

### AUD-COM-004 — Cálculo monetario alterna Decimal de PostgreSQL con `number`

- **Severidad:** Media preventiva.
- **Evidencia:** `main.ts:11-14` serializa `Prisma.Decimal` usando `.toNumber()`. Las ventas calculan importes con multiplicación/suma JS (`sale.service.ts:63-67`) y compra acepta `number` para totales/cantidades (`create-purchase.dto.ts:29-37,67-70`).
- **Problema/consecuencia:** IEEE-754 no representa algunos decimales exactamente y el contrato JSON vuelve a convertir Decimal a número. Los importes actuales con escala 2 suelen caber en el rango seguro, así que no se midió una pérdida material en los casos paraguayos probados; la política de redondeo no está centralizada.
- **Corrección:** definir escala/regla de redondeo por moneda y línea, calcular con decimal fijo en dominio o minor units, y mantener respuesta numérica solo en frontera de UI si se demuestra segura.
- **Pruebas:** totales límite, cantidad fraccionaria, descuentos, cuotas, devoluciones parciales y suma reconciliada contra PostgreSQL.
- **Bloquea despliegue:** no como defecto reproducido; sí probar contra datos autorizados antes de reconciliar históricos.

### AUD-ARCH-002 — Cliente Prisma generado no está incluido y los scripts locales no lo generan

- **Severidad:** Baja/Media de reproducibilidad.
- **Evidencia:** `src/generated/prisma` está ignorado (`posengine-backend/.gitignore:58`); el Dockerfile backend ejecuta `npx prisma generate`, pero `package.json` no tiene `prebuild`/`pretest`. En worktree limpio, `npm ci` seguido directamente de `npm run build`/Jest falló por módulos generados ausentes; después de `npx prisma generate`, build y suite pasaron.
- **Problema/consecuencia:** quien use los scripts locales en checkout nuevo recibe errores que parecen código roto si omite el paso generado.
- **Corrección Bloque 6:** `prebuild` y `pretest` ejecutan `prisma generate`; los scripts CI `build:compiled`/`test:unit` evitan repetir la generación tras el paso explícito. Docker usa la versión del CLI bloqueada y genera cliente una vez en build. Ningún lifecycle ejecuta migraciones.
- **Pruebas:** reproducir `npm ci`, `prisma generate`, build, Jest y validate desde checkout limpio.
- **Bloquea despliegue:** no si se construye por Dockerfile actual.

### AUD-SEC-007 — El endpoint de borrado de uploads no comprueba propietario/tenant

- **Estado del seguimiento:** **Resuelto** (checkout local; 2026-11-13).
- **Severidad:** Media.
- **Causa original:** bucket compartido con nombres planos; endpoint autenticado sin rol ni tenant y borrado por nombre global.
- **Solución:** los uploads nuevos se guardan en namespace `tenantId/UUID.webp`, con `tenantId` tomado de `@CurrentUser`; upload y delete requieren rol ADMIN/SUPERADMIN. El endpoint de borrado recibe solo basename UUID y el servicio construye la clave del tenant autenticado; traversal y nombres históricos sin dueño verificable se rechazan. Productos también validan referencias de storage gestionado y ya no borran rutas locales derivadas de URLs sin validación.
- **Archivos históricos:** no existe metadata ni namespace que pruebe el dueño de objetos raíz; no se les asignó tenant, no se eliminan y no se permite reclamarlos como logo nuevo. Los productos pueden conservar referencias históricas existentes, pero su sustitución no borra esos objetos.
- **Pruebas:** tenant A sube y elimina su archivo; tenant B no puede borrar esa clave; filename inexistente/legacy y traversal se rechazan; rol ausente o no permitido se rechaza; referencias de logo/producto cruzadas se rechazan.
- **Migración:** ninguna. La asociación se verifica desde la ruta namespaced y los cambios Prisma habrían requerido atribuir dueños de históricos sin evidencia.
- **Riesgo residual:** el bucket y la carpeta estática son públicos por el uso actual de imágenes de producto; una URL pública conocida sigue siendo legible directamente. No se usa esa URL como permiso para eliminar ni para asignar una imagen de otro tenant.
- **Bloquea despliegue:** no por sí solo; corrección aplicada localmente antes de ofrecer almacenamiento compartido a tenants no confiables.

## C. Mejoras para versiones futuras o tras medir

### AUD-ARCH-003 — Aislamiento tenant existe principalmente en la aplicación

- **Severidad:** Media preventiva; no se confirmó IDOR en los flujos críticos revisados.
- **Evidencia:** controladores pasan tenant obtenido desde `@CurrentUser` y servicios revisados filtran Prisma por `tenantId` (por ejemplo ventas, devoluciones, productos y usuarios). `Tenant` y sus relaciones no muestran políticas RLS ni claves foráneas compuestas que obliguen a que ambas entidades compartan tenant.
- **Problema/consecuencia:** una futura consulta que olvide el filtro o una relación creada manualmente puede romper aislamiento sin que PostgreSQL lo impida.
- **Corrección:** mantener tests cruzados de tenant en cada endpoint sensible; evaluar constraints compuestas solo donde puedan agregarse sin cambiar relaciones existentes; RLS requeriría definir primero el mecanismo de session/tenant para conexiones Prisma.
- **No se recomienda:** introducir repositorios o RLS global solo por patrón, sin plan de migración y pruebas.
- **Bloquea despliegue:** no hay exploit confirmado; completar tests de autorización de endpoints faltantes.

### AUD-ARCH-004 — `.next` de la raíz está versionado y genera ruido local

- **Severidad:** Baja.
- **Evidencia:** 84 archivos bajo `.next/` están versionados en HEAD, mientras `posengine-web/.gitignore` solo ignora el `.next` de esa subcarpeta. El checkout mostró cambios de chunks/mapas generados en la raíz.
- **Problema/consecuencia:** artefactos locales se mezclan con estado de Git y ensucian diffs; no hacen falta para build, tests o runtime. Se comprobó esto en worktree limpio.
- **Corrección:** en una tarea de higiene separada, retirar cache raíz del índice y añadir patrón correcto. No se hizo durante esta auditoría para respetar los cambios locales.
- **Bloquea despliegue:** no.

### AUD-OPS-001 — Backup local ignorado y `.env` no forman evidencia de recuperación

- **Severidad:** Baja en el repositorio; sensibilidad potencial del entorno local.
- **Evidencia:** en la revisión inicial se detectaron un dump local y un archivo de entorno ignorados por Git. No se leyeron, no se usaron para pruebas y no se incluyen en este cambio.
- **Problema/consecuencia:** su presencia no prueba que el backup esté completo, autorizado, vigente o restaurable. Puede contener datos privados; debe gestionarse fuera del control de versiones.
- **Corrección:** confirmar retención/cifrado/autoridad de esos artefactos en la política operativa; verificar restauración solo con copia autorizada y entorno aislado. No borrar automáticamente.
- **Bloquea despliegue:** no por estar local; sí falta el runbook de A.

## Componentes que conviene conservar

- Los módulos principales separan transporte HTTP y servicios de dominio; no recomiendo dividir `CashSessionService`, dashboard o pantallas solo por cantidad de líneas.
- La capa global aplica `JwtAuthGuard`, `ThrottlerGuard` y `RolesGuard` (`auth.module.ts:55-66`); la estrategia JWT vuelve a consultar el usuario y el refresh hash activo, por lo que logout individual invalida el access token asociado (`jwt.strategy.ts:38-59`, `logout.service.ts:8-16`).
- El PIN usa cookie `HttpOnly`, Secure en producción, token de dispositivo aleatorio guardado como hash, hash bcrypt del PIN, bloqueo por intentos y comprobación de estado activo al emitir sesión (`quick-pin.service.ts`, `auth.controller.ts:34-42`). Desactivar el usuario y resetear contraseña revocan sesiones y dispositivos.
- Las ventas descuentan stock mediante SQL condicional atómico y protegido por tenant (`stock-movement.service.ts:155-165`). Devoluciones y conciliación usan transacciones, locks/actualizaciones condicionales y eventos de auditoría; la integración PostgreSQL cubre carreras de devoluciones, pagos y caja.
- Los DTO globales aplican `whitelist`, `forbidNonWhitelisted` y transformación (`main.ts:39-45`). El CORS usa allowlist explícita (`main.ts:19-33`), aunque producción debe configurar el origen exacto.
- La búsqueda reciente pagina y filtra en la base; el dashboard usa un helper de hora de negocio con pruebas. La auditoría no justifica una reescritura arquitectónica amplia.

## Estado local y reproducibilidad

### Diferencias sin commit en la revisión inicial (histórico)

Se conservaron intactas en esa revisión. Las 25 entradas de `git status --short` eran:

- 13 entradas de `.next` raíz (chunks/maps generados).
- `posengine-backend/package.json` con dos scripts de semilla QA; las dependencias y el lockfile no cambian por ese diff.
- `posengine-backend/src/scripts/` (semilla QA), tres scripts de benchmark/seed browser, un mock de upload.
- Cinco documentos locales de QA/propuesta/diseño.
- `posiblesMejoras.txt`.

No son dependencias de compilación/runtime/pruebas del commit. El worktree limpio se construyó y probó sin ellos. No se borraron ni se modificaron.

### Validación aislada ejecutada en la revisión inicial (histórico)

En un checkout temporal detached del commit base, con `npm ci` de ambos lockfiles:

- Frontend `npx tsc --noEmit`: pasó.
- Frontend `npm run build`: pasó; Next generó 32 páginas, pero Next omitió su verificación TypeScript por `ignoreBuildErrors`.
- Frontend Node tests: 42/42 pasaron.
- Backend `npx prisma validate`: pasó.
- Backend `npx prisma generate` + `npm run build`: pasó.
- Backend `npm test -- --runInBand`: 22 suites, 128/128 tests pasaron.
- PostgreSQL 16 desechable en `127.0.0.1:55439/posengine_sales_test`: las 50 migraciones aplicaron y `sales-postgres.integration.cjs` pasó 86/86. El contenedor fue detenido y el worktree temporal eliminado.
- `docker compose config --quiet`: válido con avisos de variable `NEXT_PUBLIC_API_URL` no definida y `version` obsoleta. No inicié servicios Compose.
- Auditoría de dependencias `npm audit --omit=dev`: frontend 8 avisos (1 crítica, 6 altas, 1 moderada); backend 20 (2 críticas, 13 altas, 5 moderadas). Los fixes no se aplicaron.

## Plan de trabajo original (actualizado tras el Bloque 5; supersedido por el seguimiento del Bloque 6)

1. Bloques 1–5 resueltos en el checkout local, pendientes de commit y repetición de CI.
2. Bloque 6: limpieza acotada de logs rutinarios, consultas duplicadas, scripts de Prisma, TypeScript, artefactos generados y deuda mantenible.
3. Bloque 7: solucionar contrato Compose/Nginx/API y publicación de PostgreSQL; validar capacidades, backup/restauración, migración con datos sintéticos existentes, datos históricos autorizados y recuperación.
4. Antes de release, coordinar las versiones de frontend/backend para que todos los clientes envíen claves idempotentes y ejecutar la validación final en staging.
5. Mantener para seguimiento la deprecación de consulta concurrente reportada por pg, las decisiones de CSP/correo/sesiones PIN y la medición de búsqueda con datos representativos.

## Evidencia no disponible en la revisión inicial / límites

- No se inspeccionó ningún secreto del `.env`, ni el contenido del dump local; no se accedió a Supabase, producción o base habitual.
- No se usó una copia autorizada de los datos reales, así que no se certifican conteos/constraints de históricos ni tiempos de migración a escala de producción.
- No se inspeccionó firewall, dominio, proveedor cloud, configuración Nginx externa ni observabilidad de la instalación; el riesgo de publicación pública de PostgreSQL debe confirmarse en el servidor de staging.
- No se ejecutó E2E visual en browser ni benchmark de búsqueda con una distribución real de productos.
- El audit de npm identifica rangos y advisories; cada advisory transitivo debe mapearse a código/ruta efectiva antes de afirmar exploitabilidad.


## Seguimiento del Bloque 6 — 2026-11-14

- **AUD-COM-002:** el formulario `/dashboard/clients/payments` sí usa `Idempotency-Key`. La clave es opcional en el backend por compatibilidad con clientes antiguos, por lo que esos clientes y llamadas directas sin clave siguen siendo repetibles. La intención pendiente vive en `sessionStorage`, limitada a la pestaña; pestañas independientes no comparten su single-flight ni la clave.
- **AUD-COM-003:** corregido localmente con caché compartida por usuario/tenant, TTL de 30 s, deduplicación concurrente e invalidación por sesión. El backend permanece como autoridad de capacidades.
- **Logs rutinarios:** `sale.transaction.completed` está condicionado a `POSENGINE_LOG_SALE_PERFORMANCE=true`; una prueba unitaria confirma que la venta exitosa no lo emite por defecto. `sale.transaction.failed` continúa en el catch. La revisión de compras, pagos y devoluciones no encontró logs equivalentes de éxito que aportaran ruido y requirieran eliminarse; se conservaron eventos de error, advertencias y logs de inicio.
- **TypeScript/Prisma:** `ignoreBuildErrors` eliminado; scripts `typecheck`, `prisma:generate`, `prisma:validate`, `test:unit`, `test:postgres` y `build:compiled` definidos. `prebuild`/`pretest` generan el cliente; no ejecutan migraciones.
- **AUD-ARCH-004:** 84 rutas `.next` de raíz están identificadas como generadas; patrón `/.next/` añadido y se retiraron del índice con `git rm --cached`, preservando archivos locales.
- **AUD-REL-002:** workflow Tauri desktop archivado fuera de workflows activos. CI nuevo cubre ambos proyectos y una instancia efímera PostgreSQL 16, con permisos mínimos y credenciales sintéticas. No hay run remoto porque no se hizo push.
- **AUD-DEPLOY-003:** `.dockerignore` frontend y backend excluyen configuración local, dependencias, caches, dumps y mocks temporales, manteniendo el esquema/migraciones Prisma. El build de imagen/contexto real sigue pendiente de Bloque 7.
- **Node.js:** se fija Node 24.15.0 en `.node-version`, engines `24.x` y Docker `node:24-alpine`. La configuración real de los dashboards de Render/Vercel no es accesible desde este checkout y debe verificarse antes del despliegue.
- **Advertencia pg:** la suite anterior reportó la llamada de `pg@8.22.0` desde `@prisma/adapter-pg` en `PgTransaction.performIO` al llegar otra consulta mientras una estaba activa/en cola; el driver serializa, las 103 verificaciones anteriores pasaron. No se añadió lock global ni se atribuyó a lógica de aplicación.
- **Pruebas frontend:** el registro histórico 42/42 era 37 casos de etiquetas + 5 casos auth existentes en el commit base. El informe de Bloque 5 9/9 contó únicamente el archivo auth (5 originales + 3 refresh + 1 idempotencia), omitiendo otras suites. El conjunto actual se ejecuta íntegro con `node --test`/`npm test`.
- **Validación de cierre local:** frontend `npm ci`, `npm run typecheck`, `npm test` **49/49**, build y `npm audit --omit=dev` (0 vulnerabilidades); backend `npm ci`, generación Prisma, validación de esquema, suite Jest **26 suites / 153 pruebas**, build compilado y `npm audit --omit=dev` (0 vulnerabilidades); PostgreSQL 16 aislado, **51 migraciones aplicadas y 103/103** integración; YAML CI parseado y `git diff --check`/`git diff --cached --check` aprobados. No se ejecutó remote CI ni build Docker en este bloque. AUD-REL-001, riesgos de datos/restore, RLS/tenant, `pg` upstream y la configuración real de Render/Vercel permanecen pendientes del Bloque 7. No se asigna puntuación nueva.
- **Node reportado por el entorno de desarrollo:** v24.15.0. Los documentos de plataforma consultados respaldan Node 24, pero no verifican dashboards del comercio: [Render Node version](https://render.com/docs/node-version), [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Node 20 está en fase de retirada anunciada por Vercel para 2026-10-01 ([changelog](https://vercel.com/changelog/node-js-20-is-being-deprecated)).
