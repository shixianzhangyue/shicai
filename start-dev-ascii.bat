@echo off
setlocal EnableDelayedExpansion
title TalentVault Dev Server
cd /d "%~dp0"

echo.
echo  ================================================
echo     TalentVault v1.1 - Development Launcher
echo  ================================================
echo.

:: Step 1: Kill stale TalentVault processes
echo  [1/5] Cleaning stale processes...

:: Kill talent-vault.exe (the app binary)
taskkill /F /IM talent-vault.exe >nul 2>&1
if !errorlevel! equ 0 (
    echo       talent-vault.exe terminated.
) else (
    echo       No stale talent-vault.exe found.
)

:: Kill Vite node processes listening on port 1420
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING" 2^>nul') do (
    echo       Killing PID %%a on port 1420...
    taskkill /F /PID %%a >nul 2>&1
)
echo       Done.

:: Step 2: Verify prerequisites
echo  [2/5] Checking prerequisites...

:: Check node_modules
if not exist "node_modules" (
    echo       node_modules not found. Running pnpm install...
    call pnpm install
    if !errorlevel! ne 0 (
        echo       ERROR: pnpm install failed.
        pause
        exit /b 1
    )
)

:: Check pnpm
where pnpm >nul 2>&1
if !errorlevel! ne 0 (
    echo       ERROR: pnpm not found in PATH.
    echo       Install: npm install -g pnpm
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('pnpm -v 2^>nul') do echo       pnpm: v%%v

:: Check cargo
where cargo >nul 2>&1
if !errorlevel! ne 0 (
    echo       WARNING: cargo not found. Tauri backend may fail to compile.
    echo       Install Rust: https://rustup.rs/
) else (
    for /f "tokens=2" %%v in ('cargo -v 2^>nul ^| findstr /C:"cargo"') do echo       cargo: %%v
)

:: Step 3: Check port 1420
echo  [3/5] Checking port 1420...
netstat -ano | findstr ":1420" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo       WARNING: Port 1420 still in use. Force cleanup...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING"') do (
        echo       Killing PID %%a ...
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)
echo       Port 1420 is ready.

:: Step 4: Show info
echo  [4/5] Configuration:
echo       Frontend:  http://localhost:1420
echo       Command:   pnpm tauri dev
echo       Hot reload: enabled
echo.

:: Step 5: Start dev server
echo  [5/5] Starting TalentVault...
echo  ------------------------------------------------
echo   Press Ctrl+C to stop. Close window to exit.
echo  ------------------------------------------------
echo.

pnpm tauri dev

:: Post-exit cleanup
echo.
echo  TalentVault stopped. Cleaning up...
taskkill /F /IM talent-vault.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo  Cleanup complete.
timeout /t 3 /nobreak >nul