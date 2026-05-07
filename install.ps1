$ErrorActionPreference = "Stop"

Write-Host "=== POSENGINE INSTALLER ===" -ForegroundColor Cyan

# ─── ETAPA 1: Instalar Docker si no existe ───────────────────────
$dockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$dockerInstalled = Test-Path $dockerExe

if (-not $dockerInstalled) {
    Write-Host "[1/2] Docker no encontrado. Instalando..." -ForegroundColor Yellow

    # Descargar instalador directo (más confiable que winget)
    $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
    
    Write-Host "Descargando Docker Desktop (~600MB, puede tardar varios minutos)..."
    Invoke-WebRequest "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" `
        -OutFile $dockerInstaller

    Write-Host "Instalando Docker Desktop..."
    Start-Process $dockerInstaller -ArgumentList "install --quiet --accept-license" -Wait

    # Registrar etapa 2 para después del reinicio
    $stage2Script = "C:\PosEngine-install-stage2.ps1"
    New-Item -ItemType Directory -Force -Path "C:\PosEngine" | Out-Null
    Copy-Item $PSCommandPath $stage2Script

    # Auto-ejecutar después del reinicio
    Set-ItemProperty `
        -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce" `
        -Name "PosEngineInstall" `
        -Value "powershell -ExecutionPolicy Bypass -File `"$stage2Script`""

    Write-Host ""
    Write-Host "Docker instalado. SE NECESITA REINICIAR." -ForegroundColor Yellow
    Write-Host "El instalador continuará automáticamente después del reinicio." -ForegroundColor Yellow
    Write-Host ""
    
    Read-Host "Presiona ENTER para reiniciar ahora"
    Restart-Computer -Force
    exit 0
}

# ─── ETAPA 2: Docker ya instalado, continuar ─────────────────────
Write-Host "[1/2] Docker encontrado. Verificando que esté corriendo..." -ForegroundColor Green

# Esperar a que Docker Engine levante (puede tardar hasta 60s después del reinicio)
$maxWait = 120
$waited = 0
Write-Host "Esperando que Docker Engine esté listo..."

while ($waited -lt $maxWait) {
    $result = & "C:\Program Files\Docker\Docker\resources\bin\docker.exe" version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker listo." -ForegroundColor Green
        break
    }
    Write-Host "  Esperando... ($waited/$maxWait segundos)"
    Start-Sleep -Seconds 10
    $waited += 10
}

if ($waited -ge $maxWait) {
    Write-Host "ERROR: Docker no respondió a tiempo." -ForegroundColor Red
    Write-Host "Abrí Docker Desktop manualmente, esperá que termine de cargar y volvé a ejecutar este instalador."
    Read-Host "Presiona ENTER para cerrar"
    exit 1
}

# ─── Crear carpetas ───────────────────────────────────────────────
Write-Host "[2/2] Configurando PosEngine..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path "C:\PosEngine" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\PosEngine\backups" | Out-Null

# ─── Descargar archivos ───────────────────────────────────────────
$base = "https://raw.githubusercontent.com/wildbergerlopezk/posengine-installer/main"

Write-Host "Descargando configuración..."
Invoke-WebRequest "$base/docker-compose.yml" -OutFile "C:\PosEngine\docker-compose.yml"
Invoke-WebRequest "$base/nginx.conf"          -OutFile "C:\PosEngine\nginx.conf"
Invoke-WebRequest "$base/update-backend.bat"  -OutFile "C:\PosEngine\update-backend.bat"
Invoke-WebRequest "$base/backup.bat"          -OutFile "C:\PosEngine\backup.bat"

# ─── .env ─────────────────────────────────────────────────────────
Write-Host "Creando .env..."
@"
POSTGRES_USER=posengine
POSTGRES_PASSWORD=password_muy_segura_123
POSTGRES_DB=posengine
JWT_SECRET=un_secreto_largo_y_random_aqui
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
NODE_ENV=production
"@ | Out-File "C:\PosEngine\.env" -Encoding UTF8

# ─── Docker Compose ───────────────────────────────────────────────
Write-Host "Iniciando contenedores..."
Set-Location "C:\PosEngine"
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose up falló." -ForegroundColor Red
    Read-Host "Presiona ENTER para cerrar"
    exit 1
}

# ─── Descargar e instalar PosEngine Desktop ─────────────────────
Write-Host "Instalando PosEngine..."

$ghToken = "$token" # Reemplazá con tu token personal de GitHub con permisos de repo (puede ser de solo lectura)   
$ghHeaders = @{ 
    Authorization = "token $ghToken"
    "User-Agent"  = "PosEngine-Installer"
}

$latestJson = Invoke-RestMethod `
    "https://api.github.com/repos/wildbergerlopezk/posengine-frontend/releases/latest" `
    -Headers $ghHeaders

$msiAsset = $latestJson.assets | Where-Object { $_.name -like "*.msi" } | Select-Object -First 1

if (-not $msiAsset) {
    Write-Host "ERROR: No se encontró el .msi en el último release" -ForegroundColor Red
    exit 1
}

Write-Host "Descargando $($msiAsset.name)..."
$assetUrl = "https://api.github.com/repos/wildbergerlopezk/posengine-frontend/releases/assets/$($msiAsset.id)"

Invoke-WebRequest $assetUrl `
    -Headers @{ 
        Authorization = "token $ghToken"
        Accept        = "application/octet-stream"
    } `
    -OutFile "C:\PosEngine\posengine-setup.msi" `
    -MaximumRedirection 10

Start-Process "msiexec.exe" -ArgumentList "/i `"C:\PosEngine\posengine-setup.msi`" /quiet" -Wait

# ─── Limpiar RunOnce si vino de reinicio ──────────────────────────
Remove-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce" `
    -Name "PosEngineInstall" -ErrorAction SilentlyContinue

Remove-Item "C:\PosEngine-install-stage2.ps1" -ErrorAction SilentlyContinue

# ─── Fin ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  POSENGINE INSTALADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Read-Host "Presiona ENTER para cerrar"