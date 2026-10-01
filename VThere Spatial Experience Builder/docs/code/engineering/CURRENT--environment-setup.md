# Environment Setup

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

Quick reference for this repo's preflight scripts. For the full walkthrough (frontend-only vs. full-stack, failure modes, what's actually implemented), see [Getting the Project Running](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Getting-the-Project-Running) on the wiki.

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

Node.js 22+, npm, and `node_modules` presence — frontend only. They do not validate Python, Docker, or `.env` variables.

The npm `predev`/`prebuild` hooks run the Node check automatically once npm is available. The standalone PowerShell/Bash scripts exist because npm can't run when Node.js itself is missing.

## Backend and local services (apps/api)

```powershell
copy .env.example .env
docker compose up -d
cd apps/api
pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

Needs Python 3.12+, Docker Desktop running. `docker-compose.yml` starts `postgres` (5432) and `minio` (9000/9001) — see [docker-local-dev-environment.md](LEARNING--docker-local-dev-environment.md). `.env.example` documents every variable `apps/api/app/config.py` reads; copy it to `.env`, never edit the example itself.

Verify with `curl http://localhost:8000/health`. Run the test suite from `VThere Spatial Experience Builder/`, not `apps/api/` (tests import `apps.api.app.main`):

```powershell
python -m pytest apps/api/tests -q
```

## Why not CMake?

CMake is useful for native C/C++ compilation, but this project is a Vite/React/TypeScript application with a Python API. It would add another tool without solving the actual setup problem. Small platform-native preflight scripts are easier for contributors to run and easier to maintain.