# Repository Plan

## Proposed hierarchy

```text
project-root/
â”œâ”€â”€ README.md
â”œâ”€â”€ LICENSE
â”œâ”€â”€ .gitignore
â”œâ”€â”€ .env.example
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ Makefile
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ UNDATED--CURRENT--project-context.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--project-scope.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--tech-stack.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--architecture.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--repository.md
â”‚   â”œâ”€â”€ integration.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--contracts.md
â”‚   â”œâ”€â”€ dependency-graph.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--build-system.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--testing-strategy.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--implementation-plan.md
â”‚   â”œâ”€â”€ security-and-stress-testing.md
â”‚   â””â”€â”€ subsystems/
â”‚       â””â”€â”€ simulation-domain.md
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ package-lock.json or selected lockfile
â”‚   â”œâ”€â”€ tsconfig.json
â”‚   â”œâ”€â”€ vite.config.ts
â”‚   â”œâ”€â”€ public/
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ main.tsx
â”‚       â”œâ”€â”€ App.tsx
â”‚       â”œâ”€â”€ api/
â”‚       â”œâ”€â”€ types/
â”‚       â”œâ”€â”€ state/
â”‚       â”œâ”€â”€ components/
â”‚       â”œâ”€â”€ cesium/
â”‚       â”œâ”€â”€ charts/
â”‚       â””â”€â”€ utils/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ pyproject.toml
â”‚   â”œâ”€â”€ requirements.txt or generated install file
â”‚   â””â”€â”€ app/
â”‚       â”œâ”€â”€ main.py
â”‚       â”œâ”€â”€ api/
â”‚       â”œâ”€â”€ schemas/
â”‚       â”œâ”€â”€ services/
â”‚       â”œâ”€â”€ simulation/
â”‚       â”œâ”€â”€ data/
â”‚       â”œâ”€â”€ db/
â”‚       â””â”€â”€ config/
â”œâ”€â”€ shared/
â”‚   â”œâ”€â”€ schemas/
â”‚   â””â”€â”€ examples/
â”œâ”€â”€ data/
â”‚   â”œâ”€â”€ raw/
â”‚   â”œâ”€â”€ processed/
â”‚   â”œâ”€â”€ synthetic/
â”‚   â””â”€â”€ README.md
â”œâ”€â”€ scripts/
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ frontend/
â”‚   â””â”€â”€ integration/
â”œâ”€â”€ infra/
â”‚   â”œâ”€â”€ docker/
â”‚   â”œâ”€â”€ nginx/
â”‚   â””â”€â”€ cloud/
â””â”€â”€ .github/workflows/
```

## Directory classification

### FIXED

- `docs/` planning and architecture records.
- `frontend/` frontend region.
- `backend/` backend/application and simulation region.
- `shared/` cross-boundary schemas and deterministic examples.
- `tests/` test region.
- `data/` data region.
- `infra/` infrastructure region.
- `.github/workflows/` CI region.

Renaming, moving, or removing these regions requires architectural approval.

### EXTENSIBLE

- `frontend/src/api`, `types`, `state`, `components`, `cesium`, `charts`, and `utils`.
- `backend/app/api`, `schemas`, `services`, `simulation`, `data`, `db`, and `config`.
- `tests/backend`, `tests/frontend`, and `tests/integration`.
- `scripts/` for bounded data/setup tooling.
- `docs/subsystems/` for independently complex subsystem specifications.

New files may be added inside these boundaries when they implement an approved responsibility.

### GENERATED

- Frontend build output.
- Python/Node dependency caches and virtual environments.
- Docker build output.
- Coverage and test reports.
- Database-generated local volumes.

Generated content must not be committed unless explicitly documented.

### OPTIONAL

- `infra/nginx/`, `infra/cloud/`, optional BESS/solar modules, deployment manifests, and advanced charting or comparison modules.

## Naming conventions

- Python modules and functions: `snake_case`.
- Python classes and TypeScript types/components: `PascalCase`.
- TypeScript variables/functions: `camelCase`.
- API paths: lowercase plural nouns with explicit action paths only where required, such as `/api/scenarios/simulate`.
- Shared contract names: one canonical name across backend, frontend, and documentation.
- Tests: `test_<subject>` for Python and the repository's selected frontend convention.

## Placement rules

- HTTP route handlers belong in `backend/app/api/`.
- Pydantic transport schemas belong in `backend/app/schemas/`.
- Orchestration belongs in `backend/app/services/`.
- Simulation rules belong in `backend/app/simulation/`.
- Persistence translation belongs in `backend/app/data/` and `backend/app/db/`.
- Frontend HTTP access belongs in `frontend/src/api/`.
- Frontend visual components must not become data repositories or simulation engines.
- Cross-boundary schemas/examples belong in `shared/`.
- New top-level systems require an architecture decision.

## Repository verification

A baseline implementation agent must compare the actual tree against this document, report missing or unexpected architectural elements, and verify that generated files and local data are ignored appropriately before writing implementation code.
