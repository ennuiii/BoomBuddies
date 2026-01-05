@echo off
REM ============================================
REM GameBuddies Template - Development Runner
REM ============================================
REM
REM This script starts both the game server and client for local development.
REM
REM Prerequisites:
REM   - Node.js 18+ installed
REM   - npm install run in both client/ and GameBuddieGamesServer/
REM
REM Usage:
REM   Double-click this file or run from command line: run-dev.bat
REM

echo.
echo ============================================
echo   GameBuddies Template - Dev Environment
echo ============================================
echo.

REM Get the directory where this batch file is located
set TEMPLATE_DIR=%~dp0
set SERVER_DIR=%TEMPLATE_DIR%..\GameBuddieGamesServer
set CLIENT_DIR=%TEMPLATE_DIR%client

REM Check if server directory exists
if not exist "%SERVER_DIR%" (
    echo [ERROR] GameBuddieGamesServer not found at: %SERVER_DIR%
    echo Please ensure the server is located at: E:\GamebuddiesPlatform\GameBuddieGamesServer
    pause
    exit /b 1
)

REM Check if client directory exists
if not exist "%CLIENT_DIR%" (
    echo [ERROR] Client not found at: %CLIENT_DIR%
    pause
    exit /b 1
)

REM Check if node_modules exist
if not exist "%SERVER_DIR%\node_modules" (
    echo [WARNING] Server node_modules not found. Running npm install...
    cd /d "%SERVER_DIR%"
    call npm install
)

if not exist "%CLIENT_DIR%\node_modules" (
    echo [WARNING] Client node_modules not found. Running npm install...
    cd /d "%CLIENT_DIR%"
    call npm install
)

echo.
echo Starting GameBuddies Game Server...
echo   Location: %SERVER_DIR%
echo   URL: http://localhost:3000
echo.

REM Start the server in a new window
start "GameBuddies Server" cmd /k "cd /d "%SERVER_DIR%" && npm run dev"

REM Wait a moment for server to initialize
timeout /t 3 /nobreak > nul

echo.
echo Starting Template Client...
echo   Location: %CLIENT_DIR%
echo   URL: http://localhost:5173
echo.

REM Start the client in a new window
start "Template Client" cmd /k "cd /d "%CLIENT_DIR%" && npm run dev"

echo.
echo ============================================
echo   Development servers starting...
echo ============================================
echo.
echo   Server: http://localhost:3000
echo   Client: http://localhost:5173
echo.
echo   Press any key to close this window.
echo   (The server and client windows will remain open)
echo.

pause > nul
