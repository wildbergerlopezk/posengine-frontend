# Guía de Reinstalación del Proyecto (posengine)

Esta guía te ayudará a configurar rápidamente tu computadora después de formatearla. Sigue estos pasos para tener todo funcionando en pocos minutos.

## 📋 Requisitos Previos

Antes de empezar, asegúrate de instalar lo siguiente:

1.  **Node.js (versión 20 o superior):** [Descárgalo aquí](https://nodejs.org/).
2.  **Git:** Para clonar tu repositorio si no lo tienes respaldado físicamente.
3.  **Rust (para Tauri):** Es necesario para la aplicación de escritorio.
    - Ejecuta en tu terminal: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
4.  **PostgreSQL:** Si planeas correr la base de datos localmente.

---

## 🚀 Paso 1: Instalación Automática (Recomendado)

He creado un script que instala todas las dependencias de las tres partes del proyecto:
- **Frontend (Web):** `posengine-web`
- **Backend:** `posengine-backend`
- **Desktop:** `posengine-desktop`

El script también genera el cliente de Prisma para el backend automáticamente.

1.  Abre una terminal en la carpeta principal del proyecto.
2.  Ejecuta el script:
    ```bash
    ./install-deps.sh
    ```

Este script hará todo el trabajo pesado ("copiar todas y ya") de forma automática para todo el proyecto, **incluyendo el frontend**.

---

## 💻 Detalles Específicos del Frontend (posengine-web)

Si prefieres hacer solo la parte del frontend manualmente:

1.  Entra en la carpeta: `cd posengine-web`
2.  Instala las dependencias: `npm install`
3.  Crea el archivo `.env` (ver sección abajo).
4.  Corre el proyecto: `npm run dev`

El frontend usa **Next.js 16** y **Tailwind CSS**. Todas las librerías de UI (Radix, Shadcn) se instalan automáticamente con el `npm install`.

---

## 🔑 Paso 2: Variables de Entorno (.env)

Los archivos `.env` no se suben a Git por seguridad. **Asegúrate de respaldar el contenido de estos archivos antes de formatear.**

Deberás crear manualmente los archivos `.env` en sus respectivas carpetas después de reinstalar:

### En `posengine-web/.env`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3005
```

### En `posengine-backend/.env`:
Deberás poner tus credenciales de base de datos y tus secretos JWT:
```env
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/posengine"
JWT_SECRET="TU_SECRETO_AQUÍ"
PORT=3005
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3001
```

---

## 🛠️ Paso 3: Comandos Útiles

Si quieres correr cada proyecto por separado:

- **Web:** `cd posengine-web && npm run dev`
- **Backend:** `cd posengine-backend && npm run start:dev`
- **Desktop:** `cd posengine-desktop && npm run dev`

---

## ⚡ Solución de Problemas Rápidos

- **Error con Prisma:** Si ves errores de base de datos, asegúrate de correr `npx prisma generate` dentro de `posengine-backend`.
- **Error en Desktop:** Asegúrate de que `rustc` esté en tu PATH ejecutando `rustc --version`.
