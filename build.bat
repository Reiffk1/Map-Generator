@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Wayfinder Atelier Launcher

set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell"

if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

if /I "%~1"=="help" goto :help
if /I "%~1"=="--help" goto :help
if /I "%~1"=="/?" goto :help

set "APP_EXE=%CD%\src-tauri\target\release\wayfinder_atelier.exe"
set "FORCE_BUILD=0"
if /I "%~1"=="rebuild" set "FORCE_BUILD=1"

if "%FORCE_BUILD%"=="0" (
  call :release_is_current
  if not errorlevel 1 goto :open_existing
  echo Existing desktop build is stale. Rebuilding...
)

if "%FORCE_BUILD%"=="1" (
  echo Forcing a fresh desktop rebuild...
)

call :require_command node.exe "Node.js"
if errorlevel 1 goto :fail
call :require_command npm.cmd "npm"
if errorlevel 1 goto :fail
call :require_command cargo.exe "Cargo"
if errorlevel 1 goto :fail

if not exist "node_modules" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 goto :fail
)

call :stop_running_app

echo Building Wayfinder Atelier...
call npm.cmd run tauri:build
if errorlevel 1 goto :fail

if not exist "%APP_EXE%" goto :missing_exe

echo Opening Wayfinder Atelier...
start "" "%APP_EXE%"
goto :success

:open_existing
call :stop_running_app
echo Opening current Wayfinder Atelier build...
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
echo Could not find %~2.
echo Make sure Node.js and Rust are installed, then try again.
exit /b 1

:missing_exe
echo Could not find:
echo   %APP_EXE%
echo The build finished without the expected app executable.
exit /b 1

:help
echo.
echo Wayfinder Atelier launcher
echo.
echo Usage:
echo   build.bat
echo     Quick path. Opens the current compiled app if it is up to date.
echo     If your source changed, it rebuilds and then opens the app.
echo.
echo   build.bat rebuild
echo     Forces a fresh release build, then opens the app.
echo.
echo   build.bat help
echo     Shows this message.
echo.
exit /b 0

:fail
echo.
echo Launch failed.
exit /b 1

:success
exit /b 0
