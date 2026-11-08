@echo off
REM VectorSpace - one-command setup, build, test, and run.
REM
REM Usage:
REM   run.bat             full pipeline, then serve the app
REM   run.bat --no-e2e    skip the browser tests (they download Chromium on first run)
REM   run.bat --ci        run every check and exit without serving
REM   run.bat --no-docker serve the static build only (no API / database)
REM
REM After the checks, if Docker Desktop is running, this starts the full local stack
REM (Postgres in Docker + API + web app) via VectorSpace\scripts\dev-stack-docker.bat.
REM Without Docker it falls back to serving the frontend build on its own.

setlocal EnableDelayedExpansion

set "APP_DIR=VectorSpace"
set "MIN_NODE_MAJOR=22"
set "MIN_NPM_MAJOR=10"
set "RUN_E2E=1"
set "SERVE=1"
set "DOCKER=1"

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--no-e2e" set "RUN_E2E=0" & shift & goto parse_args
if /i "%~1"=="--ci"     set "SERVE=0"   & shift & goto parse_args
if /i "%~1"=="--no-docker" set "DOCKER=0" & shift & goto parse_args
if /i "%~1"=="-h"       goto show_help
if /i "%~1"=="--help"   goto show_help
echo Unknown option: %~1 (try --help)>&2
exit /b 2

:show_help
echo run.bat             full pipeline, then serve the app
echo run.bat --no-e2e    skip the browser tests
echo run.bat --ci        run every check and exit without serving
echo run.bat --no-docker serve the static build only (no API / database)
exit /b 0

:args_done

REM Always operate from the repository root, no matter where this is called from.
cd /d "%~dp0"

set /a TOTAL=5
if "%RUN_E2E%"=="1" set /a TOTAL+=1
if "%SERVE%"=="1" set /a TOTAL+=1
set /a STEP=0

echo VectorSpace
echo ================================

REM ---------------------------------------------------------------- environment
call :say "Checking environment"

where node >nul 2>&1
if errorlevel 1 call :die "Node.js was not found." "Install Node.js %MIN_NODE_MAJOR% LTS or newer from https://nodejs.org/ and reopen your terminal."

for /f "delims=" %%v in ('node --version') do set "NODE_VERSION=%%v"
for /f "tokens=1 delims=." %%a in ("!NODE_VERSION:v=!") do set "NODE_MAJOR=%%a"
if !NODE_MAJOR! LSS %MIN_NODE_MAJOR% call :die "Node.js %MIN_NODE_MAJOR%+ is required; found !NODE_VERSION!." "Install Node.js %MIN_NODE_MAJOR% LTS or newer from https://nodejs.org/"
echo   Node.js: !NODE_VERSION!

where npm >nul 2>&1
if errorlevel 1 call :die "npm was not found." "Install Node.js LTS, which bundles npm."

for /f "delims=" %%v in ('npm.cmd --version') do set "NPM_VERSION=%%v"
for /f "tokens=1 delims=." %%a in ("!NPM_VERSION!") do set "NPM_MAJOR=%%a"
if !NPM_MAJOR! LSS %MIN_NPM_MAJOR% call :die "npm %MIN_NPM_MAJOR%+ is required; found !NPM_VERSION!." "Run: npm install -g npm@latest"
echo   npm: !NPM_VERSION!

if not exist "%APP_DIR%\package.json" call :die "Could not find the app directory '%APP_DIR%'." "Run this script from the repository root, on a complete clone."

cd /d "%APP_DIR%"

REM ------------------------------------------------------------------- install
call :say "Installing locked dependencies (npm ci)"
call npm.cmd ci
if errorlevel 1 call :die "Dependency installation failed." "Check your network connection. If package-lock.json is out of sync, run 'npm install' to refresh it."

REM ----------------------------------------------------------------- typecheck
call :say "Type-checking"
call npm.cmd run typecheck
if errorlevel 1 call :die "TypeScript reported type errors (see above)."

REM --------------------------------------------------------------- unit tests
call :say "Running unit tests"
call npm.cmd test
if errorlevel 1 call :die "Unit tests failed (see above)."

REM --------------------------------------------------------------------- build
call :say "Building production bundle"
call npm.cmd run build
if errorlevel 1 call :die "Production build failed (see above)."

REM -------------------------------------------------------------- browser tests
if "%RUN_E2E%"=="1" (
  call :say "Running browser tests"
  REM Chromium is ~130MB and is only downloaded the first time.
  call npx.cmd playwright install chromium
  if errorlevel 1 (
    echo   WARNING: could not download the Chromium test browser; skipping browser tests.
    echo   Everything else passed. Re-run with network access, or use --no-e2e to skip this step.
  ) else (
    call npm.cmd run test:e2e
    if errorlevel 1 call :die "Browser tests failed (see above)." "Open the report with: npx playwright show-report"
  )
)

REM --------------------------------------------------------------------- serve
if "%SERVE%"=="0" (
  echo.
  echo All checks passed.
  exit /b 0
)

call :say "Starting the app"

if "%DOCKER%"=="1" (
  docker info >nul 2>&1
  if errorlevel 1 (
    echo   Docker is not running: serving the frontend build only.
    echo   Start Docker Desktop and re-run for the full stack (API + database^).
  ) else (
    call scripts\dev-stack-docker.bat
    exit /b !errorlevel!
  )
)

echo.
echo   ----------------------------------------------------------------
echo   All checks passed. Serving the production build.
echo.
echo     Open http://localhost:4173 in your browser.
echo     Press Ctrl+C to stop.
echo   ----------------------------------------------------------------
echo.

call npm.cmd run preview -- --host 127.0.0.1 --port 4173
exit /b %errorlevel%

REM ------------------------------------------------------------------ helpers
:say
set /a STEP+=1
echo.
echo [!STEP!/%TOTAL%] %~1
exit /b 0

:die
echo.>&2
echo ----------------------------------------------------------------->&2
echo FAILED: %~1>&2
if not "%~2"=="" echo %~2>&2
echo ----------------------------------------------------------------->&2
REM Exit the whole script, not just this subroutine.
exit 1
