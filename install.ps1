# install.ps1
# Correr como Administrador en la PC del cliente

Write-Host "Instalando PosEngine..." -ForegroundColor Cyan

# 1. Instalar Docker Desktop
Write-Host "Instalando Docker Desktop..."
winget install -e --id Docker.DockerDesktop --silent
# Esperar a que Docker arranque
Start-Sleep -Seconds 30

# 2. Crear carpeta del sistema
Write-Host "Creando archivos del sistema..."
New-Item -ItemType Directory -Force -Path "C:\PosEngine" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\PosEngine\backups" | Out-Null

# 3. Bajar archivos de configuración desde tu GitHub
$base = "https://raw.githubusercontent.com/wildbergerlopezk/posengine/main"

Invoke-WebRequest "$base/docker-compose.yml" -OutFile "C:\PosEngine\docker-compose.yml"
Invoke-WebRequest "$base/update-backend.bat" -OutFile "C:\PosEngine\update-backend.bat"
Invoke-WebRequest "$base/backup.bat"         -OutFile "C:\PosEngine\backup.bat"

# 4. Crear el .env con las credenciales
@"
DB_USER=posengine
DB_PASSWORD=password_muy_segura_123
JWT_SECRET=un_secreto_largo_y_random_aqui
"@ | Out-File "C:\PosEngine\.env" -Encoding UTF8

# 5. Levantar los contenedores (baja las imágenes de Docker Hub)
Write-Host "Descargando e iniciando backend..."
Set-Location "C:\PosEngine"
docker compose up -d

# 6. Instalar el .msi de Tauri (el frontend)
Write-Host "Instalando PosEngine app..."
Invoke-WebRequest "https://github.com/wildbergerlopezk/posengine/releases/latest/download/posengine_1.0.0_x64-setup.msi" `
  -OutFile "C:\PosEngine\posengine-setup.msi"
Start-Process "C:\PosEngine\posengine-setup.msi" -ArgumentList "/quiet" -Wait

# 7. Configurar Docker para que arranque solo con Windows
# (Docker Desktop ya hace esto por defecto)

Write-Host "Instalacion completada!" -ForegroundColor Green
Write-Host "PosEngine esta listo para usar."