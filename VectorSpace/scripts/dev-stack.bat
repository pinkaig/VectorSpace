@echo off
rem Starts the whole local stack in "dry mode" (no Auth0): Postgres in Docker, the API, the browser app.
rem   scripts\dev-stack.bat         start everything (Docker Desktop must already be running)
rem   scripts\dev-stack.bat stop    stop Postgres (the API and browser app run in their own windows: close them)
rem First run installs the API's Python packages into apps\api\.venv, which takes a minute.
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

cd apps\api
if not exist .venv\Scripts\python.exe (
  python -m venv .venv || (echo Python 3 is needed to build the API environment. & exit /b 1)
  .venv\Scripts\python -m pip install -r requirements.txt || exit /b 1
)
.venv\Scripts\alembic upgrade head || exit /b 1
.venv\Scripts\python -m app.seed --apply || exit /b 1

start "VectorSpace API" cmd /k ".venv\Scripts\uvicorn app.main:app --port 8000"
cd ..\..
start "VectorSpace web" cmd /k "set VITE_API_URL=http://localhost:8000&& npm run dev"

echo.
echo API:      http://localhost:8000/health
echo Browser:  http://localhost:5173   (click Educator or Student)
endlocal
