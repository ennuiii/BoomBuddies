# ============================================
# GameBuddies Template - Development Runner
# ============================================
#
# This script starts both the game server and client for local development.
#
# Prerequisites:
#   - Node.js 18+ installed
#   - npm install run in both client/ and GameBuddieGamesServer/
#
# Usage:
#   Right-click -> Run with PowerShell
#   Or from terminal: .\run-dev.ps1
#

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  GameBuddies Template - Dev Environment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Get paths
$TemplateDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path (Split-Path -Parent $TemplateDir) "GameBuddieGamesServer"
$ClientDir = Join-Path $TemplateDir "client"

# Check if server directory exists
if (-not (Test-Path $ServerDir)) {
    Write-Host "[ERROR] GameBuddieGamesServer not found at: $ServerDir" -ForegroundColor Red
    Write-Host "Please ensure the server is located at: E:\GamebuddiesPlatform\GameBuddieGamesServer" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if client directory exists
if (-not (Test-Path $ClientDir)) {
    Write-Host "[ERROR] Client not found at: $ClientDir" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if node_modules exist and install if needed
if (-not (Test-Path (Join-Path $ServerDir "node_modules"))) {
    Write-Host "[WARNING] Server node_modules not found. Running npm install..." -ForegroundColor Yellow
    Push-Location $ServerDir
    npm install
    Pop-Location
}

if (-not (Test-Path (Join-Path $ClientDir "node_modules"))) {
    Write-Host "[WARNING] Client node_modules not found. Running npm install..." -ForegroundColor Yellow
    Push-Location $ClientDir
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "Starting GameBuddies Game Server..." -ForegroundColor Green
Write-Host "  Location: $ServerDir" -ForegroundColor Gray
Write-Host "  URL: http://localhost:3000" -ForegroundColor Gray
Write-Host ""

# Start the server in a new window
$serverProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ServerDir'; npm run dev" -PassThru

# Wait a moment for server to initialize
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Starting Template Client..." -ForegroundColor Green
Write-Host "  Location: $ClientDir" -ForegroundColor Gray
Write-Host "  URL: http://localhost:5173" -ForegroundColor Gray
Write-Host ""

# Start the client in a new window
$clientProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ClientDir'; npm run dev" -PassThru

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Development servers starting..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Server: " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Client: " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Enter to close this window." -ForegroundColor Gray
Write-Host "  (The server and client windows will remain open)" -ForegroundColor Gray
Write-Host ""

Read-Host
