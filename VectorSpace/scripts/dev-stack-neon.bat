@echo off
rem Starts the local stack in "dry mode" (no Auth0) against hosted Neon Postgres, so a machine
rem without Docker Desktop can still run the API and the browser app.
rem   scripts\dev-stack-neon.bat           start everything (offers the seed if it is missing)
rem   scripts\dev-stack-neon.bat seed      start, and re-write the demo school first
rem   scripts\dev-stack-neon.bat noseed    start, and never offer to seed
rem There is nothing to stop: Neon is not ours to switch off. Close the two windows.
rem
rem The only difference from scripts\dev-stack-docker.bat is where the data lives, and that
rem matters: a Neon database is shared and it survives. Point this at a Neon BRANCH of your
rem own (Neon dashboard > Branches > New branch), not at the branch the Render deploy reads,
rem or the demo school below lands in what the team treats as staging.
rem
rem DATABASE_URL has to be set, either in apps\api\.env (where the API itself reads it) or in
rem this window before running. Unset, the API quietly falls back to localhost:5432, which is
rem the Docker script's database, so this one refuses to start rather than guess.
setlocal
cd /d "%~dp0.."

rem settings the API reads from the environment; the dev login is only allowed because
rem APP_ENV says local. The deployed API runs with APP_ENV=production and refuses to start
rem with the bypass on at all, which is why the Render site cannot offer the role picker.
set APP_ENV=local
set AUTH_DEV_BYPASS=true
set CORS_ORIGINS=http://localhost:5173

cd apps\api
if not exist .venv\Scripts\python.exe (
  python -m venv .venv || (echo Python 3 is needed to build the API environment. & exit /b 1)
  .venv\Scripts\python -m pip install -r requirements.txt || exit /b 1
)

rem Which database are we actually about to migrate? Settings reads .env and the environment
rem exactly as the API does, so this is the answer the API would give. It prints nothing when
rem DATABASE_URL is unset, rather than the localhost default that would stand in for it. It
rem writes without a newline, so %DBHOST% does not pick up a trailing carriage return.
set DBHOST=
for /f "usebackq delims=" %%H in (`.venv\Scripts\python -c "from app.config import get_settings as g; from urllib.parse import urlparse as u; s=g(); import sys; sys.stdout.write((u(s.sqlalchemy_database_url).hostname or '') if s.database_url else '')"`) do set DBHOST=%%H

if "%DBHOST%"=="" (
  echo.
  echo DATABASE_URL is not set, so the API would fall back to localhost:5432.
  echo Put the Neon connection string in apps\api\.env:
  echo.
  echo   DATABASE_URL=postgresql://user:pw@ep-xxx.aws.neon.tech/neondb?sslmode=require
  echo.
  echo Neon dashboard ^> your project ^> Connect. For a local Postgres instead, use
  echo scripts\dev-stack-docker.bat.
  exit /b 1
)

echo %DBHOST% | findstr /i "localhost 127.0.0.1" >nul
if not errorlevel 1 (
  echo DATABASE_URL points at %DBHOST%, which is a local database, not Neon.
  echo Use scripts\dev-stack-docker.bat for that.
  exit /b 1
)

echo Database: %DBHOST%
.venv\Scripts\alembic upgrade head || exit /b 1

rem The role picker signs in as the seeded dev|teacher and dev|student1 people, so an empty
rem database answers GET /me with 403 and the picker looks broken. Offer the seed exactly when
rem it is missing, and never write to a shared database without being told to. chr(124) rather
rem than a literal pipe: cmd would read that as one. sys.stdout.write rather than print, so
rem the value reaches the variable without the carriage return print would add.
set SEEDED=
for /f "usebackq delims=" %%S in (`.venv\Scripts\python -c "from sqlalchemy import create_engine, text; from app.config import get_settings as g; e=create_engine(g().sqlalchemy_database_url); r=e.connect().execute(text('select 1 from actors where auth0_subject = :s'), {'s': 'dev' + chr(124) + 'teacher'}).first(); import sys; sys.stdout.write('1' if r else '')"`) do set SEEDED=%%S

if /i "%~1"=="noseed" goto :start
if /i "%~1"=="seed" goto :offer
if not "%SEEDED%"=="" goto :start

:offer
echo.
echo The demo school ^(one admin, three teachers, 24 students, five classes^) is not in this
echo database yet, and the role picker needs it. Re-running it is safe: it deletes nothing.
set /p REPLY="Write it into %DBHOST%? [y/N] "
if /i not "%REPLY%"=="y" goto :skipped
.venv\Scripts\python -m app.seed --apply || exit /b 1
goto :start

:skipped
echo Skipped. Educator and Student will be refused until this database is seeded.

:start
start "VectorSpace API (Neon)" cmd /k ".venv\Scripts\uvicorn app.main:app --port 8000"
cd ..\..
start "VectorSpace web" cmd /k "set VITE_API_URL=http://localhost:8000&& npm run dev"

echo.
echo API:      http://localhost:8000/health
echo Browser:  http://localhost:5173   (click Educator or Student)
echo.
echo Neon sleeps after about five minutes idle and wakes in under a second, so the first
echo request after a pause is the slow one. Nothing to stop when you are done: close the
echo two windows.
endlocal
