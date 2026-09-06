# Repository Plan

## Proposed hierarchy

```text
project-root/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Makefile
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── projectscope.md
│   ├── techstack.md
│   ├── architecture.md
│   ├── repository.md
│   ├── integration.md
│   ├── contracts.md
│   ├── dependency-graph.md
│   ├── build-system.md
│   ├── testing-strategy.md
│   ├── implementation-plan.md
│   └── subsystems/
│       └── simulation-domain.md
├── frontend/
│   ├── package.json
│   ├── package-lock.json or selected lockfile
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       ├── types/
│       ├── state/
│       ├── components/
│       ├── cesium/
│       ├── charts/
│       └── utils/
├── backend/
│   ├── pyproject.toml
│   ├── requirements.txt or generated install file
│   └── app/
│       ├── main.py
│       ├── api/
│       ├── schemas/
│       ├── services/
│       ├── simulation/
│       ├── data/
│       ├── db/
│       └── config/
├── shared/
│   ├── schemas/
│   └── examples/
├── data/
│   ├── raw/
│   ├── processed/
│   ├── synthetic/
│   └── README.md
├── scripts/
├── tests/
│   ├── backend/
│   ├── frontend/
│   └── integration/
├── infra/
│   ├── docker/
│   ├── nginx/
│   └── cloud/
└── .github/workflows/
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
