# setup.ps1 — Inicialización de Gastoh en Windows (PowerShell)
# Uso: .\setup.ps1
# Requiere Docker Desktop en ejecución.

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

Write-Host "`n=== Gastoh — Setup inicial ===" -ForegroundColor Cyan

# 1. Verificar Docker
Write-Host "`n[1/5] Verificando Docker..." -ForegroundColor Yellow
try {
  docker info 2>&1 | Out-Null
  Write-Host "  ✓ Docker está disponible"
} catch {
  Write-Host "  ✗ Docker no responde. Abre Docker Desktop y espera a que cargue." -ForegroundColor Red
  exit 1
}

# 2. Crear .env si no existe
Write-Host "`n[2/5] Configurando .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  (Get-Content ".env") -replace 'cambia-esto-por-una-cadena-aleatoria-de-al-menos-32-caracteres', $secret |
    Set-Content ".env" -Encoding utf8
  Write-Host "  ✓ .env creado con SESSION_SECRET aleatorio"
} else {
  Write-Host "  ✓ .env ya existe, se mantiene"
}

# 3. Build y arrancar
Write-Host "`n[3/5] Construyendo imagen Docker (puede tardar 2-5 min la primera vez)..." -ForegroundColor Yellow
docker compose build
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Fallo en build" -ForegroundColor Red; exit 1 }

Write-Host "`n[4/5] Arrancando contenedor..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Fallo al arrancar" -ForegroundColor Red; exit 1 }

# Esperar a que el contenedor esté sano
Write-Host "  Esperando a que la app arranque..."
$attempts = 0
do {
  Start-Sleep -Seconds 2
  $attempts++
  $status = docker compose ps --format json 2>$null | ConvertFrom-Json | Select-Object -First 1
} while ($attempts -lt 20 -and ($null -eq $status -or $status.State -ne 'running'))
Write-Host "  ✓ Contenedor en ejecución"

# 5. Crear usuario admin
Write-Host "`n[5/5] Creando usuario administrador..." -ForegroundColor Yellow
$adminUser = Read-Host "  Nombre de usuario (Enter = admin)"
if ([string]::IsNullOrWhiteSpace($adminUser)) { $adminUser = "admin" }

$adminPass = Read-Host "  Contraseña" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass)
$plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

docker compose cp setup-admin.js gastoh:/app/setup-admin.js
docker compose exec gastoh node setup-admin.js $adminUser $plainPass

Write-Host "`n=== ¡Listo! ===" -ForegroundColor Green
Write-Host "  Abre http://localhost:3000 en tu navegador"
Write-Host "  Usuario: $adminUser"
