# Environment Setup

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

The project uses a preflight check to tell contributors exactly why development cannot start.

## Windows

From `VThere Spatial Experience Builder`:

```powershell
.\scripts\check-environment.ps1
npm.cmd install
npm.cmd run dev
```

If PowerShell blocks scripts, run the check through a temporary process-policy override:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

Install Node.js 22 LTS or newer from [nodejs.org](https://nodejs.org/). npm is included with Node.js.

## macOS/Linux

```bash
bash scripts/check-environment.sh
npm install
npm run dev
```

## What the checks verify

- Node.js 22 or newer.
- npm availability.
- Installed `node_modules` dependencies.
- A clear non-zero exit code when setup is incomplete.

The npm `predev` and `prebuild` hooks run the Node check automatically once npm itself is available. The standalone PowerShell/Bash scripts are necessary because npm cannot run when Node.js is missing.

These checks cover the frontend only. They do not validate Python, Docker, or environment
variables — see below for the backend setup.

## Backend and local services (apps/api)

The API needs Python 3.12+, plus Postgres and MinIO running locally. From
`VThere Spatial Experience Builder/`:

```powershell
copy .env.example .env
docker compose up -d
```

`docker-compose.yml` starts `postgres` (port 5432) and `minio` (ports 9000/9001) with health
checks and named volumes; see
[docker-local-dev-environment.md](LEARNING--docker-local-dev-environment.md) for
details. `.env.example` documents every variable `apps/api/app/config.py` reads (Postgres
credentials, `DATABASE_URL`, MinIO credentials/endpoint/bucket, `APP_ENV`, `CORS_ORIGINS`,
`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`); copy it to `.env` before running the API.

Install the API's Python dependencies and run migrations:

```powershell
cd apps/api
pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

Verify with `curl http://localhost:8000/health`. Run the API test suite from
`VThere Spatial Experience Builder/` (not from `apps/api/`, since the tests import
`apps.api.app.main`):

```powershell
python -m pytest apps/api/tests -q
```

## Why not CMake?

CMake is useful for native C/C++ compilation, but this project is a Vite/React/TypeScript application with a Python API. It would add another tool without solving the actual setup problem. Small platform-native preflight scripts are easier for contributors to run and easier to maintain.