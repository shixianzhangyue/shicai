@echo off
setlocal EnableDelayedExpansion
title TalentVault Stop Service
cd /d "%~dp0"

echo.
echo  ================================================
echo     Stopping TalentVault Development Server
echo  ================================================
echo.

set "KILLED=0"

:: Step 1: Kill TalentVault app
echo  [1/4] Stopping TalentVault app...
tasklist /FI "IMAGENAME eq talent-vault.exe" 2>nul | findstr "talent-vault.exe" >nul 2>&1
if !errorlevel! equ 0 (
    taskkill /F /IM talent-vault.exe >nul 2>&1
    echo       talent-vault.exe terminated.
    set /a KILLED+=1
) else (
    echo       talent-vault.exe not running.
)

:: Step 2: Kill processes on port 1420
echo  [2/4] Stopping processes on port 1420...
set "PORT_PIDS="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING" 2^>nul') do (
    if defined PORT_PIDS (
        set "PORT_PIDS=!PORT_PIDS! %%a"
    ) else (
        set "PORT_PIDS=%%a"
    )
)
if defined PORT_PIDS (
    for %%p in (!PORT_PIDS!) do (
        for /f "tokens=1" %%n in ('tasklist /FI "PID eq %%p" /FO CSV /NH 2^>nul ^| findstr "%%p"') do (
            echo       PID %%p is %%~n - terminating...
        )
        taskkill /F /PID %%p >nul 2>&1
        set /a KILLED+=1
    )
    echo       Port 1420 cleared.
) else (
    echo       No processes on port 1420.
)

:: Step 3: Kill project-related cargo/rustc processes
echo  [3/4] Checking for Rust compiler processes...
set "RUST_KILLED=0"
for /f "tokens=2 delims=," %%a in ('tasklist /FI "IMAGENAME eq cargo.exe" /FO CSV /NH 2^>nul ^| findstr "cargo.exe"') do (
    set "PID=%%~a"
    tasklist /FI "PID eq !PID!" /FI "IMAGENAME eq cargo.exe" 2>nul | findstr "cargo.exe" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       Killing cargo.exe PID !PID!
        taskkill /F /PID !PID! >nul 2>&1
        set /a KILLED+=1
        set /a RUST_KILLED+=1
    )
)
for /f "tokens=2 delims=," %%a in ('tasklist /FI "IMAGENAME eq rustc.exe" /FO CSV /NH 2^>nul ^| findstr "rustc.exe"') do (
    set "PID=%%~a"
    tasklist /FI "PID eq !PID!" /FI "IMAGENAME eq rustc.exe" 2>nul | findstr "rustc.exe" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       Killing rustc.exe PID !PID!
        taskkill /F /PID !PID! >nul 2>&1
        set /a KILLED+=1
        set /a RUST_KILLED+=1
    )
)
if !RUST_KILLED! equ 0 (
    echo       No Rust compiler processes found.
)

:: Step 4: Final verification
echo  [4/4] Verifying cleanup...
timeout /t 1 /nobreak >nul
set "REMAINING=0"
tasklist /FI "IMAGENAME eq talent-vault.exe" 2>nul | findstr "talent-vault.exe" >nul 2>&1
if !errorlevel! equ 0 (
    echo       WARNING: talent-vault.exe still running!
    set /a REMAINING+=1
)
netstat -ano | findstr ":1420" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo       WARNING: Port 1420 still occupied!
    set /a REMAINING+=1
)

echo.
if !REMAINING! equ 0 (
    echo  ================================================
    echo   All TalentVault services stopped. (!KILLED! process(es) killed^)
    echo  ================================================
) else (
    echo  ================================================
    echo   Some processes could not be terminated.
    echo   Try running as Administrator.
    echo  ================================================
)
echo.
timeout /t 3 /nobreak >nul