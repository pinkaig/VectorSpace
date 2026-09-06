# Dependency Installation Log

Date: 2026-09-06
Project: ChargedUp Cross-Site Energy & Sustainability Simulator
Platform: Windows PowerShell

## Runtime prerequisites

The approved runtime packages were located with:

```powershell
winget search --id OpenJS.NodeJS.22 --exact
winget search --id Python.Python.3.12 --exact
winget search --id Docker.DockerDesktop --exact
```

Installed successfully:

```powershell
winget install --id OpenJS.NodeJS.22 --exact --scope user --accept-source-agreements --accept-package-agreements
winget install --id Python.Python.3.12 --exact --scope user --accept-source-agreements --accept-package-agreements
```

Detected versions:

```text
Node.js 22.23.2
npm 10.9.8
Python 3.12.10
```

Docker Desktop was located but not installed in this session because its installer may require elevation and a reboot. The package command is:

```powershell
winget install --id Docker.DockerDesktop --exact --accept-source-agreements --accept-package-agreements
```

## Frontend dependencies

Because the project directory contains `&`, npm scripts were run through a temporary drive letter:

```powershell
$project = (Resolve-Path 'ChargedUp Cross-Site Energy & Sustainability Simulator').Path
subst X: $project
Push-Location 'X:\frontend'
& "$nodeDir\npm.cmd" install
Pop-Location
subst X: /d
```

Result: successful. `node_modules` was installed and `frontend/package-lock.json` was regenerated. The manifest uses Vite 6 with `@vitejs/plugin-react` 4.3.4 because plugin 6 requires Vite 8.

## Backend dependencies

```powershell
$python = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
Push-Location 'ChargedUp Cross-Site Energy & Sustainability Simulator'
& $python -m venv backend\.venv
& 'backend\.venv\Scripts\python.exe' -m pip install --upgrade pip
& 'backend\.venv\Scripts\python.exe' -m pip install -r backend\requirements.txt
& 'backend\.venv\Scripts\python.exe' -m pip install pip-audit
Pop-Location
```

Result: successful. Backend requirements and `pip-audit` 2.10.1 are installed in `backend/.venv`.

## Verification commands

```powershell
cd frontend
npm run typecheck
npm run build
npm run test

cd ..\backend
.venv\Scripts\python.exe -m pytest ..\tests\backend ..\tests\security ..\tests\stress -q
```

Results: `npm ci`, frontend typecheck, production build, and Vitest passed. Python compile, backend API/security/stress tests (6 passed), integration test (1 passed), and seed command passed with one Starlette deprecation warning.

## Dependency audits

```powershell
cd frontend
npm audit --audit-level=high

cd ..\backend
.venv\Scripts\python.exe -m pip_audit -r requirements.txt
```

Results:

- npm audit: failed with 5 vulnerabilities: 3 moderate, 1 high, and 1 critical. npm recommends `npm audit fix --force`, which would move dependencies outside the approved ranges and was not applied automatically.
- pip-audit: failed with 11 known findings across `pytest`, `python-dotenv`, and transitive `starlette` versions. Fix versions require upgrades beyond the current baseline pins and need a dependency decision.

## Build status

The frontend and backend source builds are passing. Docker Compose, PostgreSQL migration, and container build remain pending Docker Desktop installation.

Docker Desktop was subsequently installed and verified. Because the project path contains `&`, Compose was run with an explicit project name:

```powershell
docker compose -p chargedup -f "ChargedUp Cross-Site Energy & Sustainability Simulator\docker-compose.yml" up -d
docker compose -p chargedup -f "ChargedUp Cross-Site Energy & Sustainability Simulator\docker-compose.yml" ps
```

Results: PostGIS healthy, backend and frontend containers started, backend image built successfully, frontend image built successfully. Alembic migration and seed completed successfully. Live checks returned `DATABASE=ready`, 2 sites, 96 simulation intervals, 720.0 kWh, and frontend HTTP 200.

## Remaining setup

After Docker Desktop is installed and running:

```powershell
docker compose up -d db
cd backend
.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
cd ..
.venv\Scripts\python.exe scripts\seed_database.py
docker compose up --build
```
