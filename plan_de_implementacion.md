# Plan de Refactorización y Rediseño: PosEngine (Sprint de 2 Semanas)

Este plan está diseñado para transformar el proyecto actual en un producto estable, rápido y visualmente premium (comercializable) antes del inicio de clases, enfocando nuestros esfuerzos donde mayor impacto tendrán.

## User Review Required

> [!IMPORTANT]
> **Cambio de Paradigma en Frontend:** Vamos a eliminar todos los archivos de estilos manuales (`.module.css`) y componentes construidos a mano con `useState`. Adoptaremos un estándar de la industria: **Tailwind CSS + shadcn/ui + React Hook Form + Zod**. Esto significa que muchas páginas se reescribirán desde cero a nivel visual, pero reutilizaremos la lógica de conexión con tu backend.
> ¿Estás de acuerdo con eliminar tu código CSS anterior para adoptar este estándar profesional?

## Open Questions

> [!WARNING]
> **Elección de Estética:** Para que el sistema sea comercializable, necesitamos un diseño que enamore a primera vista. 
> ¿Tienes alguna preferencia de colores para la marca (ej. azul corporativo, oscuro/dark mode moderno, tonos verdes)? Si no la tienes, yo propondré un tema "Dark Mode" moderno con acentos vibrantes (estilo Vercel/Stripe) que suele dar un aspecto muy premium.

## Proposed Changes

---

### Frontend (posengine-web)

El frontend sufrirá la mayor transformación para resolver la deuda técnica y mejorar radicalmente la UI/UX.

#### [DELETE] Estilos Antiguos
Eliminaremos la dependencia de los CSS modules para forzar un sistema de diseño único.
- `src/**/*.module.css` (Se eliminarán todos los archivos de este tipo).

#### [MODIFY] Infraestructura y Herramientas Core
Se instalarán y configurarán las herramientas modernas necesarias.
- `package.json`: Agregar `shadcn-ui`, `react-hook-form`, `zod`, `@tanstack/react-query`.
- `tailwind.config.js`: Configurar la paleta de colores oficial, tipografía y variables del sistema de diseño.
- `app/layout.tsx`: Integrar el proveedor de temas (Dark/Light mode) y el proveedor de notificaciones (Toasts).

#### [MODIFY] Refactor de "Fat Components"
Dividiremos las páginas masivas en componentes pequeños y manejables.
- `src/features/products/pages/ProductsPage.tsx`: Se reescribirá utilizando componentes atómicos (Tabla, Formulario en Modal, Buscador).
- `src/features/sales/pages/SalesPage.tsx`: Se rediseñará enfocándose en UX para cajeros (rápido, soporte de teclado, sin clics innecesarios).

---

### Backend (posengine-backend)

Minimizaremos los cambios en el backend para cumplir con la meta de 2 semanas, tocando solo lo crítico para el rendimiento.

#### [NEW] Módulo de Analytics (Dashboard)
Crearemos un endpoint que realice los cálculos pesados en la base de datos (PostgreSQL) en lugar de enviar miles de registros al navegador.
- `src/modules/analytics/analytics.module.ts`
- `src/modules/analytics/analytics.controller.ts`
- `src/modules/analytics/analytics.service.ts`: Consultas SQL agrupadas (ej. `SUM(total) WHERE date = TODAY`).

## Verification Plan

### Manual Verification
1. **Prueba de POS:** Simular un día de ventas en la nueva pantalla de caja operando únicamente con teclado y lector de códigos.
2. **Prueba de Carga de Dashboard:** Verificar que el dashboard carga en menos de 1 segundo utilizando el nuevo endpoint de analytics, incluso con miles de registros en la base de datos.
3. **Responsividad:** Probar el sistema en vista de tablet y móvil (especialmente la gestión de productos y dashboard).
