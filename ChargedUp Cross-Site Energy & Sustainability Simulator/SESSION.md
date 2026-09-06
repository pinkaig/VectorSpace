# ChargedUp Cross-Site Energy & Sustainability Simulator Baseline Implementation Handoff

## Objective / topic

Baseline implementation is complete and verified for local source builds and Docker Compose startup. This handoff preserves the state before moving to the next implementation phase.

## Decisions made and why

- Browser-based architecture: React/TypeScript frontend with CesiumJS, Python/FastAPI/Pydantic backend, independent Python simulation domain, PostgreSQL/PostGIS persistence.
- Baseline runtime: Node.js 22 LTS/npm, Python 3.12, PostgreSQL 16/PostGIS 3.4.
- Baseline libraries/tools: SQLAlchemy 2, psycopg 3, Alembic, pytest, Vitest, Recharts, Docker Compose, GitHub Actions.
- Simulation results are request-scoped/in-memory for the baseline. Persistent `/api/simulations` storage is deferred.
- Baseline comparison must use two validated result objects or remain deferred; unsupported result IDs must not be introduced.
- Local baseline has no authentication, with production authentication/TLS/secrets deferred.
- Baseline data uses synthetic WGS84 EPSG:4326 coordinates.
- Server owns authoritative site capacity, charger power, tariffs, and emissions assumptions. Client input must be limited to approved scenario assumptions and bounded overrides.
- Baseline API resource limits are required: 1 MiB request body, 32 sites, 64 chargers/site, 10,000 vehicles, one-day horizon, 5-60 minute timesteps, maximum 288 intervals, 10-second simulation timeout, and one concurrent simulation per local process unless implementation documents a justified adjustment.

## Current skeleton/plan state

### Approved and documented

- `projectscope.md`
- `techstack.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/architecture.md`
- `docs/repository.md`
- `docs/integration.md`
- `docs/contracts.md`
- `docs/dependency-graph.md`
- `docs/build-system.md`
- `docs/testing-strategy.md`
- `docs/implementation-plan.md`
- `docs/subsystems/simulation-domain.md`
- `docs/pre-baseline-validation.md` with status `READY`
- `docs/security-and-stress-testing.md` with vulnerability register and stress-test plan

### Implementation status

Step 4 baseline skeleton is generated. Frontend/backend entry points, transport contracts, deterministic simulation, repository boundary, migration, seed path, Compose topology, CI, shared fixture, and security/stress tests now exist. No full visual feature implementation has been generated.

## Build/verify command

Source build commands:

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

Security/stress checks to add and run during baseline generation:

```text
python -m pytest tests/security
python -m pytest tests/stress
npm run test -- security
npm audit --audit-level=high
python -m pip_audit -r backend/requirements.txt
```

Current verification status: Node.js 22.23.2, Python 3.12.10, and Docker Desktop are installed. Frontend `npm ci`, typecheck, build, and Vitest pass. Backend compile, API/security/stress tests, integration test, seed command, and `pip check` pass. Compose images build, PostGIS is healthy, migrations and seed pass, and live health/sites/simulation/frontend smoke checks pass. The stack is currently shut down with `docker compose down`; no database volume reset was performed. npm and pip audits report unresolved advisories documented in `docs/dependency-installation-log.md`.

## Files touched this session

### Project planning files

- `projectscope.md`
- `techstack.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/architecture.md`
- `docs/repository.md`
- `docs/integration.md`
- `docs/contracts.md`
- `docs/dependency-graph.md`
- `docs/build-system.md`
- `docs/testing-strategy.md`
- `docs/implementation-plan.md`
- `docs/subsystems/simulation-domain.md`
- `docs/pre-baseline-validation.md`
- `docs/security-and-stress-testing.md`

### Workflow files

- `Agent Skills/04_Baseline_Generation.md`
- `Agent Skills/05_Phase_Implementation.md`

## Failed approaches already tried

- An incremental patch to `docs/build-system.md` temporarily inserted sections inside code fences and was replaced with a clean document. The current build-system document was structurally checked afterward.
- Docker Compose initially found a duplicate database container on port 5432; the duplicate container created during baseline setup was removed without resetting volumes.

## Open questions / deferred work

- Production authentication, authorisation, TLS, and secret management.
- Cloud provider and production deployment topology.
- Persistent simulation-result storage and retention.
- Playwright/browser automation and generated contract clients.
- Wider browser support and a real target geography.
- Production authentication, authorisation, TLS, and secret management remain deferred.
- npm audit reports 5 vulnerabilities and pip-audit reports 11 advisories; fixes require a dependency review because they exceed current baseline pins.
- The frontend is a connectivity shell; Cesium, charts, time playback, and full scenario editing remain future implementation work.

## Next recommended step

Recommended next phase:

1. Begin Phase 2/3 work from `docs/implementation-plan.md` by expanding contracts and canonical data access.
2. Resolve the npm and Python audit findings through an approved dependency decision.
3. Keep the current source/build/security evidence as the regression baseline.

## Handoff status

BASELINE IMPLEMENTATION: READY

SAFE TO `/clear` or `/compact`. The next session should read this file, `docs/PROJECT_CONTEXT.md`, and `docs/dependency-installation-log.md` before continuing.
