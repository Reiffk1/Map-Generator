@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Wayfinder Atelier Launcher
echo ============================================
echo   Wayfinder Atelier Launcher
echo ============================================
echo.

set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell"

if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
if exist "%CD%\node_modules\.bin" set "PATH=%CD%\node_modules\.bin;%PATH%"

if /I "%~1"=="help" goto :help
if /I "%~1"=="--help" goto :help
if /I "%~1"=="/?" goto :help

set "APP_EXE=%CD%\src-tauri\target\release\wayfinder_atelier.exe"
set "FORCE_BUILD=0"
if /I "%~1"=="rebuild" set "FORCE_BUILD=1"
if /I "%~1"=="dev" goto :run_dev

if "%FORCE_BUILD%"=="0" (
  call :release_is_current
  if not errorlevel 1 goto :open_existing
  echo Source files changed since last build. Rebuilding...
  echo.
)

if "%FORCE_BUILD%"=="1" (
  echo Forcing a fresh desktop rebuild...
  echo.
)

call :require_command node.exe "Node.js"
if errorlevel 1 goto :fail
call :require_command npm.cmd "npm"
if errorlevel 1 goto :fail
call :require_command cargo.exe "Cargo (Rust)"
if errorlevel 1 goto :fail

if not exist "node_modules" (
  echo Installing npm dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    goto :fail
  )
  echo.
)

call :stop_running_app

echo Building Wayfinder Atelier (this may take several minutes)...
echo.
call npm.cmd run tauri:build
if errorlevel 1 (
  echo.
  echo ERROR: Tauri build failed. Check the output above for details.
  goto :fail
)

if not exist "%APP_EXE%" goto :missing_exe

echo.
echo Build complete!
echo Opening Wayfinder Atelier...
start "" "%APP_EXE%"
goto :success

:run_dev
echo Starting development server...
echo Press Ctrl+C to stop.
echo.
call npm.cmd run tauri:dev
goto :success

:open_existing
call :stop_running_app
echo Build is up to date.
echo Opening Wayfinder Atelier...
start "" "%APP_EXE%"
goto :success

:release_is_current
if not exist "%APP_EXE%" exit /b 1
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $exe = [IO.Path]::GetFullPath('src-tauri\target\release\wayfinder_atelier.exe'); if (-not (Test-Path $exe)) { exit 1 }; $sourcePaths = @('src','public','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','src-tauri\src','src-tauri\icons','src-tauri\Cargo.toml','src-tauri\Cargo.lock','src-tauri\build.rs','src-tauri\tauri.conf.json'); $items = foreach ($path in $sourcePaths) { if (Test-Path $path) { $item = Get-Item $path; if ($item.PSIsContainer) { Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue } else { $item } } }; if (-not $items) { exit 1 }; $latestSource = ($items | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc; $exeTime = (Get-Item $exe).LastWriteTimeUtc; if ($latestSource -gt $exeTime) { exit 1 } else { exit 0 }"
exit /b %errorlevel%

:stop_running_app
tasklist /FI "IMAGENAME eq wayfinder_atelier.exe" 2>nul | find /I "wayfinder_atelier.exe" >nul
if errorlevel 1 exit /b 0
echo Closing the currently running app before rebuild...
taskkill /IM wayfinder_atelier.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul
exit /b 0

:require_command
where.exe %~1 >nul 2>&1
if "%errorlevel%"=="0" exit /b 0
echo ERROR: Could not find %~2.
echo Make sure Node.js and Rust are installed and on your PATH.
echo.
echo   Node.js: https://nodejs.org
echo   Rust:    https://rustup.rs
exit /b 1

:missing_exe
echo.
echo ERROR: Build completed but the app executable was not found at:
echo   %APP_EXE%
echo.
echo This usually means the Tauri build produced output in an unexpected location.
goto :fail

:help
echo.
echo Wayfinder Atelier Launcher
echo.
echo Usage:
echo   build.bat           Build if needed, then open the app.
echo   build.bat rebuild   Force a full rebuild, then open the app.
echo   build.bat dev       Start the development server (hot reload).
echo   build.bat help      Show this message.
echo.
pause
exit /b 0

:fail
echo.
echo ============================================
echo   BUILD FAILED
echo ============================================
echo.
pause
exit /b 1

:success
echo.
echo Done.
echo.
pause
exit /b 0
