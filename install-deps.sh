#!/bin/bash

# Script para instalar todas las dependencias del proyecto posengine
# Este script navega por las carpetas web, backend y desktop e instala todo.

echo "🚀 Iniciando la instalación de dependencias..."

# Función para verificar si un comando existe
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# 1. Verificar Node.js
if command_exists node; then
  echo "✅ Node.js detectado: $(node -v)"
else
  echo "❌ Error: Node.js no está instalado. Por favor, instálalo primero."
  exit 1
fi

# 2. Instalar dependencias en posengine-web
echo ""
echo "📦 Instalando dependencias en posengine-web..."
if [ -d "posengine-web" ]; then
  cd posengine-web
  npm install
  cd ..
else
  echo "⚠️ Advertencia: No se encontró la carpeta posengine-web"
fi

# 3. Instalar dependencias en posengine-backend
echo ""
echo "📦 Instalando dependencias en posengine-backend..."
if [ -d "posengine-backend" ]; then
  cd posengine-backend
  npm install
  echo "🛠️ Generando cliente de Prisma..."
  npx prisma generate
  cd ..
else
  echo "⚠️ Advertencia: No se encontró la carpeta posengine-backend"
fi

# 4. Instalar dependencias en posengine-desktop
echo ""
echo "📦 Instalando dependencias en posengine-desktop..."
if [ -d "posengine-desktop" ]; then
  cd posengine-desktop
  npm install
  cd ..
else
  echo "⚠️ Advertencia: No se encontró la carpeta posengine-desktop"
fi

echo ""
echo "✨ ¡Instalación completada con éxito!"
echo "Recuerda configurar tus archivos .env antes de iniciar los servicios."
