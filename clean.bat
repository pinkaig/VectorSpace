@echo off
REM Remove generated and local-only files from the working tree.
REM
REM Usage:
REM   clean.bat            show what would be removed, delete nothing
REM   clean.bat --force    actually remove it
REM   clean.bat --deps     also remove node_modules (forces a fresh npm ci)
REM
REM Only ever touches files git already ignores, so committed work is safe.
REM Dry run is the default on purpose: read the list before deleting.

setlocal EnableDelayedExpansion

set "FORCE=0"
set "DEPS=0"

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--force" set "FORCE=1" & shift & goto parse_args
if /i "%~1"=="--deps"  set "DEPS=1"  & shift & goto parse_args
if /i "%~1"=="-h"      goto show_help
if /i "%~1"=="--help"  goto show_help
echo Unknown option: %~1 (try --help)>&2
exit /b 2

:show_help
echo clean.bat            show what would be removed, delete nothing
echo clean.bat --force    actually remove it
echo clean.bat --deps     also remove node_modules
exit /b 0

:args_done

cd /d "%~dp0"

set "APP_DIR=VectorSpace"
set /a FOUND=0
set /a REMOVED=0

echo Repository cleanup
echo ==================
if "%FORCE%"=="0" echo DRY RUN - nothing will be deleted. Re-run with --force to apply.
echo.

echo Build output and caches:
call :remove_dir "%APP_DIR%\dist"
call :remove_dir "%APP_DIR%\coverage"
call :remove_dir "%APP_DIR%\playwright-report"
call :remove_dir "%APP_DIR%\test-results"
call :remove_dir "%APP_DIR%\.vite"
call :remove_dir "%APP_DIR%\.pytest_cache"
call :remove_dir "%APP_DIR%\apps\api\.pytest_cache"
if !FOUND!==0 echo   (none)

echo.
echo Python bytecode:
set /a PYC=0
for /f "delims=" %%d in ('dir /s /b /ad "%APP_DIR%\__pycache__" 2^>nul ^| findstr /v /i "node_modules"') do (
  set /a PYC+=1
  set /a FOUND+=1
  echo   %%d
  if "%FORCE%"=="1" rd /s /q "%%d" 2>nul && set /a REMOVED+=1
)
if !PYC!==0 echo   (none)

echo.
echo TypeScript build info:
set /a TSB=0
for /f "delims=" %%f in ('dir /s /b "%APP_DIR%\*.tsbuildinfo" 2^>nul ^| findstr /v /i "node_modules"') do (
  set /a TSB+=1
  set /a FOUND+=1
  echo   %%f
  if "%FORCE%"=="1" del /f /q "%%f" 2>nul && set /a REMOVED+=1
)
if !TSB!==0 echo   (none)

if "%DEPS%"=="1" (
  echo.
  echo Dependencies:
  call :remove_dir "%APP_DIR%\node_modules"
)

REM .env files are deliberately left alone: they are not recoverable.
echo.
echo Not removed - review by hand:
if exist "%APP_DIR%\.env" (echo   %APP_DIR%\.env) else (echo   (none^))

echo.
echo ----------------------------------------------------------------
if "%FORCE%"=="1" (
  echo Removed !REMOVED! of !FOUND! item^(s^).
) else (
  echo Found !FOUND! item^(s^). Re-run with --force to remove them.
)
exit /b 0

REM ------------------------------------------------------------------ helpers
:remove_dir
if not exist "%~1" exit /b 0
set /a FOUND+=1
echo   %~1
if "%FORCE%"=="1" (
  rd /s /q "%~1" 2>nul
  if not exist "%~1" set /a REMOVED+=1
)
exit /b 0
