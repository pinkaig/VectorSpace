# Build System

## Status

This document defines the reproducible baseline flow. The baseline uses Node.js 22 LTS/npm, Python 3.12/pip, PostgreSQL 16/PostGIS 3.4, SQLAlchemy 2, Alembic, pytest, Vitest, Recharts, and GitHub Actions. Exact patch versions are pinned by lockfiles and container references.

## Required toolchain

- Node.js 22 LTS and npm with `frontend/package-lock.json`.
- Python 3.12 and pinned `backend/requirements.txt`.
- PostgreSQL 16 with PostGIS 3.4.
- Docker Engine and Docker Compose.
- Git.

## Required repository files

```text
frontend/package.json
frontend/package-lock.json
frontend/tsconfig.json
frontend/vite.config.ts
backend/pyproject.toml
backend/requirements.txt
.env.example
docker-compose.yml
Makefile or documented PowerShell commands
```

## Fresh-checkout flow

```text
Fresh checkout
  -> copy .env.example to local environment configuration
  -> install frontend dependencies with npm ci
  -> create Python environment and install backend requirements
  -> start PostgreSQL/PostGIS
  -> run Alembic migrations and deterministic seed data
  -> run frontend typecheck/build and backend tests
  -> run integration checks
  -> launch frontend and backend
```

## Baseline commands

```text
cd frontend
npm ci
npm run typecheck
npm run build
npm run test

cd ../backend
python -m venv .venv
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pytest

cd ..
docker compose up -d db
alembic -c backend/alembic.ini upgrade head
python scripts/seed_database.py
docker compose up --build
```

The implementation phase must run these commands and record the actual results. A command that depends on a generated file must not be claimed as passing before that file exists.

## Build responsibilities

### Frontend

- TypeScript type checking.
- Vite development server and production build.
- Cesium assets configured for the selected bundler.
- Vitest unit/component tests.

### Backend

- Python package installation from pinned `requirements.txt` and project metadata in `pyproject.toml`.
- Import/startup check for FastAPI application.
- pytest unit and integration test execution.
- Alembic migration and deterministic seed path.

### Containers

- Frontend container or documented dev-server process.
- Backend container or documented dev-server process.
- PostgreSQL/PostGIS service.
- Shared environment/network configuration.

## Environment configuration

`.env.example` should define names, not secrets:

```text
APP_ENV=
API_HOST=
API_PORT=
DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
CORS_ORIGINS=
VITE_API_BASE_URL=
```

Local secret files must be ignored.

## Minimum acceptance commands

The implementation package must run and record:

- `npm ci`;
- `npm run typecheck` and `npm run build`;
- `python -m pytest`;
- `python -m pytest tests/integration`;
- `alembic upgrade head` and `python scripts/seed_database.py`;
- `npm run dev`;
- `uvicorn app.main:app --reload`;
- `docker compose up --build`;
- a documented database-volume reset.

## Clean-build procedure

1. Remove generated frontend/build outputs and test reports.
2. Recreate the Python environment and install pinned dependencies.
3. Run `npm ci` from the frontend directory.
4. Recreate the local database volume only when a clean database is required.
5. Apply migrations and deterministic seed data.
6. Build and test from the fresh state.

Destructive database reset commands must be documented separately from normal development commands.

## Build conflict rule

If a selected technology cannot be built with the documented toolchain, report an architectural conflict with the failing command and required decision. Do not silently replace the technology or add a major dependency.
