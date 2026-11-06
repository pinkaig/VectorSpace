@echo off
rem Starts the whole local stack in "dry mode" (no Auth0): Postgres in Docker, the API, the browser app.
rem   scripts\dev-stack-docker.bat         start everything (Docker Desktop must already be running)
rem   scripts\dev-stack-docker.bat stop    stop Postgres (the API and browser app run in their own windows: close them)
rem First run installs the API's Python packages into apps\api\.venv, which takes a minute.
rem
rem The database is the only difference from scripts\dev-stack-neon.bat, which runs the same API
rem and browser app against hosted Neon Postgres instead, for a machine without Docker. This one
rem is the better default: the data is local, disposable, and nobody else shares it.
setlocal
cd /d "%~dp0.."

if /i "%~1"=="stop" (
  docker compose stop postgres
  echo Postgres stopped. Close the "VectorSpace API" and "VectorSpace web" windows to stop the rest.
  exit /b 0
)

docker compose up -d --wait postgres || (echo Could not start Postgres. Is Docker Desktop running? & exit /b 1)

rem settings the API reads from the environment; dev login is only allowed because APP_ENV is local
set APP_ENV=local
set AUTH_DEV_BYPASS=true
set CORS_ORIGINS=http://localhost:5173

rem Point the API at the Docker Postgres above, whatever apps\api\.env says. That .env may hold a
rem Neon DATABASE_URL (for provisioning), and a process variable beats .env, so without this the
rem migrate + seed below would write to Neon. "set DATABASE_URL=" would not do: in cmd that
rem deletes the variable and .env wins again. The values are the ones docker-compose.yml uses:
rem the POSTGRES_* lines of .env, else compose's defaults.
set PGDB=vectorspace
set PGUSER=vectorspace_app
set PGPASS=vectorspace_local
if exist .env for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
  if /i "%%A"=="POSTGRES_DB" set PGDB=%%B
  if /i "%%A"=="POSTGRES_USER" set PGUSER=%%B
  if /i "%%A"=="POSTGRES_PASSWORD" set PGPASS=%%B
)
set DATABASE_URL=postgresql://%PGUSER%:%PGPASS%@localhost:5432/%PGDB%

cd apps\api
if not exist .venv\Scripts\python.exe (
  python -m venv .venv || (echo Python 3 is needed to build the API environment. & exit /b 1)
  .venv\Scripts\python -m pip install -r requirements.txt || exit /b 1
)

rem Belt and braces: ask Settings which host the API would really use, and stop unless it is local.
set DBHOST=
for /f "usebackq delims=" %%H in (`.venv\Scripts\python -c "from app.config import get_settings as g; from urllib.parse import urlparse as u; import sys; sys.stdout.write(u(g().sqlalchemy_database_url).hostname or '')"`) do set DBHOST=%%H
echo %DBHOST%| findstr /i /x "localhost 127.0.0.1" >nul || (
  echo Database host is "%DBHOST%", not the local Docker Postgres. Refusing to migrate or seed it.
  exit /b 1
)
echo Database: %DBHOST% ^(Docker^)
.venv\Scripts\alembic upgrade head || exit /b 1
.venv\Scripts\python -m app.seed --apply || exit /b 1

start "VectorSpace API" cmd /k ".venv\Scripts\uvicorn app.main:app --port 8000"
cd ..\..
start "VectorSpace web" cmd /k "set VITE_API_URL=http://localhost:8000&& npm run dev"

echo.
echo API:      http://localhost:8000/health
echo Browser:  http://localhost:5173   (click Educator or Student)
endlocal
