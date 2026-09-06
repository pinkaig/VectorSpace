# ChargedUp Cross-Site Energy & Sustainability Simulator Session Handoff

## Objective / topic

Prepare the ChargedUp Cross-Site Energy & Sustainability Simulator for baseline implementation after completing scope, technology, pre-baseline architecture, security review, and stress-test planning.

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

No application repository implementation exists yet. No frontend, backend, database schema, Docker Compose file, lockfile, test harness, or baseline code has been generated.

## Build/verify command

Commands are specified but cannot pass until the repository is generated:

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

Current verification status: not run; implementation files do not exist yet.

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
- No implementation or runtime approach has been attempted.

## Open questions / deferred work

- Production authentication, authorisation, TLS, and secret management.
- Cloud provider and production deployment topology.
- Persistent simulation-result storage and retention.
- Playwright/browser automation and generated contract clients.
- Wider browser support and a real target geography.
- Exact patch versions must be recorded in generated lockfiles and container references.
- Approved baseline tariff, emissions, ICE, and synthetic-data values remain to be selected during Phase 0/1 implementation setup.

## Next recommended step

Run step 4 using `Agent Skills/04_Baseline_Generation.md`:

1. Verify the empty repository against `docs/repository.md`.
2. Report any repository conflicts before implementation.
3. Establish frontend/backend/database infrastructure and lockfiles.
4. Add the security/stress test harness and mandatory baseline controls.
5. Build, test, start, and record actual command results.
6. Stop and report an architectural conflict if implementation requires changing contracts, technology, protocols, trust boundaries, or fixed repository regions.

## Handoff status

SAFE TO `/clear` or `/compact`. The next session should read this file and `docs/PROJECT_CONTEXT.md` before starting step 4.
