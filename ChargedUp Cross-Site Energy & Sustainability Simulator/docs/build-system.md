# Build System

## Status

This document defines the required reproducible flow. Exact runtime versions, package manager, database access library, and test frameworks must be selected before baseline implementation.

## Required toolchain

- Node.js and a locked package manager for the frontend.
- Python and a reproducible environment for the backend/simulation.
- PostgreSQL with PostGIS.
- Docker Engine and Docker Compose.
- Git.

## Required repository files

```text
frontend/package.json
frontend/tsconfig.json
frontend/vite.config.ts
backend/pyproject.toml
.env.example
docker-compose.yml
Makefile or equivalent documented task runner
```

## Fresh-checkout flow

The final baseline must support:

```text
Fresh checkout
  -> copy .env.example to local environment configuration
  -> install frontend dependencies
  -> install backend dependencies
  -> start PostgreSQL/PostGIS
  -> run migrations/seed data
  -> configure frontend and backend
  -> build frontend
  -> run backend tests
  -> run simulation tests
  -> run integration/smoke checks
  -> launch frontend and backend
```

Exact commands are to be recorded after tool versions and package managers are selected. Agents must not invent a passing command at implementation time.

## Build responsibilities

### Frontend

- TypeScript type checking.
- Vite development server and production build.
- Cesium assets configured for the selected bundler.
- Frontend tests/checks selected before baseline generation.

### Backend

- Python package installation from `pyproject.toml` and lock/reproducibility mechanism.
- Import/startup check for FastAPI application.
- Unit and integration test execution.
- Database migration and seed path.

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

The implementation package must record working commands for:

- clean dependency installation;
- frontend typecheck/build;
- backend unit tests;
- simulation tests;
- integration tests;
- database migration/seed;
- frontend startup;
- backend startup;
- Docker Compose startup;
- clean reset.

## Clean-build procedure

1. Remove generated frontend/build outputs and test reports.
2. Recreate dependency environments from lockfiles.
3. Recreate local database volume only when a clean database is required.
4. Apply migrations and deterministic seed data.
5. Build and test from the fresh state.

Destructive database reset commands must be documented separately from normal development commands.

## Build conflict rule

If a selected technology cannot be built with the documented toolchain, report an architectural conflict with the failing command and required decision. Do not silently replace the technology or add a major dependency.
