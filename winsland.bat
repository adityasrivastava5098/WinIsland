@echo off
TITLE WinIsland Runner
echo ==========================================
echo    WinIsland Runner
echo ==========================================
echo.

:: Check if node_modules exists, if not, install
if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    call npm install --no-audit --no-fund
) else (
    echo [1/3] Dependencies already installed.
)

:: Start Vite in the background
echo [2/3] Starting Vite dev server...
start /b npx vite > nul 2>&1

:: Wait for Vite to warm up
echo [3/3] Waiting for server to be ready...
timeout /t 5 /nobreak > nul

:: Launch Electron
echo.
echo Launching Dynamic Island...
set NODE_ENV=development
npx electron .

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Electron failed to start.
    pause
)
