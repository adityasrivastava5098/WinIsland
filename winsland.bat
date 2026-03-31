@echo off
TITLE WinIsland Runner
echo ==========================================
echo    WinIsland Runner
echo ==========================================
echo.

:: 1. Cleanup: Force close any STALE Electron instances to unlock folders
taskkill /F /IM electron.exe /T > nul 2>&1

:: 2. Cleanup: Wipe local cache to ensure a fresh, stable start
if exist ".winisland_data" (
    echo [0/3] Cleaning local cache...
    rmdir /S /Q ".winisland_data" > nul 2>&1
)

:: 3. Check dependencies
if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    call npm install --no-audit --no-fund
) else (
    echo [1/3] Dependencies already installed.
)

:: 4. Start Vite in the background
echo [2/3] Starting Vite dev server...
start /b npx vite > nul 2>&1

:: 5. Wait for Vite to warm up (increased time for slower systems)
echo [3/3] Waiting for server to be ready...
timeout /t 12 /nobreak > nul

:: 6. Launch Electron with forced software rendering
echo.
echo Launching WinIsland...
set NODE_ENV=development
npx electron . --disable-gpu --disable-software-rasterizer --use-gl=swiftshader

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Electron failed to start.
    echo Tip: Try running this as Administrator if permissions are an issue.
    pause
)
