# ChargedUp Cross-Site Energy & Sustainability Simulator Technology Stack

## 1. Technology Overview

The system is a browser-based application composed of a TypeScript/React frontend, a Python/FastAPI application backend, a Python simulation domain, and PostgreSQL/PostGIS persistence. HTTP/REST with JSON is the primary application integration. GeoJSON is the primary spatial exchange format.

The stack is selected for the specified interactive spatial dashboard and custom time-series simulation. The simulation domain must remain independent of React, CesiumJS, FastAPI routing, HTTP, and PostgreSQL implementation details.

## 2. Programming Languages

### Mandatory

- **TypeScript** for frontend application logic, API clients, state, validation at the UI boundary, and visualisation orchestration.
- **Python** for the backend, API services, simulation domain, data preparation, and test tooling where appropriate.
- **SQL** for PostgreSQL/PostGIS schema, queries, and migrations.

### Optional / supporting

- JSON Schema documents for shared request/result contracts.
- Shell or Make targets for local development automation, subject to platform compatibility.

## 3. Frameworks

### Frontend

- **React** for component architecture, scenario controls, dashboard, state integration, and result presentation.
- **CesiumJS** for the 3D globe/city view, site positions, spatial context, and time-dependent site-state visualisation.

### Backend

- **FastAPI** for HTTP routing, request validation integration, scenario execution endpoints, result serialisation, and API errors.
- **Pydantic** for `ScenarioRequest`, `SimulationResult`, `Site`, `Charger`, comparison, and related API contracts.

### Infrastructure

- **Docker** and **Docker Compose** for the preferred local service topology.
- **GitHub Actions** is the baseline CI provider.

## 4. Libraries

### Mandatory or primary

- **NumPy** for numerical arrays and time-series calculations where useful.
- **Pandas** for data preparation, synthetic dataset generation, and analysis/debugging where useful.
- **GeoJSON** for spatial data exchange.
- **GeoPandas** for GIS dataset preparation and GeoJSON processing.
- **Shapely** for geometry operations.
- **PyProj** for coordinate-reference-system transformations.

### Dependency boundary

- The simulation domain should use explicit domain models and should not depend on Pandas dataframes internally unless that dependency is justified.
- Frontend components must not scatter raw `fetch()` calls; backend communication belongs in the frontend API client layer.
- No library may introduce a replacement framework, live integration, or undocumented communication path without an approved architecture decision.

## 5. Runtime Environment

### Baseline runtime

- Modern supported browser with WebGL capability for CesiumJS.
- Python runtime compatible with the selected FastAPI, Pydantic, NumPy, Pandas, and GIS-library versions.
- Node.js runtime compatible with the selected React, TypeScript, Vite, and CesiumJS versions.
- PostgreSQL with PostGIS enabled.
- Docker Engine and Docker Compose for the preferred local topology.

### Runtime topology

```text
Browser
  -> Frontend dev server/container
  -> FastAPI backend
  -> PostgreSQL/PostGIS

FastAPI application service
  -> Independent Python simulation domain
```

Baseline runtime choices:

- Node.js 22 LTS with npm.
- Python 3.12.
- PostgreSQL 16 with PostGIS 3.4.
- React 19, TypeScript 5.7, Vite 6, and CesiumJS 1.125 or the nearest compatible locked release.
- FastAPI 0.115 and Pydantic 2.10 or the nearest compatible locked releases.

Exact patch releases are recorded in lockfiles and container image digests when the repository is generated.

## 6. Build System

### Frontend

- npm is the frontend package manager; `package-lock.json` is committed.
- Vite 6 is the frontend build tool.

### Backend

- Python packaging/build configuration using `pyproject.toml`.
- `requirements.txt` contains pinned backend dependencies; `pyproject.toml` defines the package and test configuration.

### Repository/infrastructure

- Dockerfiles for frontend and backend.
- Docker Compose for local orchestration.
- Makefile or equivalent PowerShell-compatible documented commands may wrap setup, build, test, and run operations.
- CI must install dependencies, build the frontend, run backend and simulation tests, and perform integration checks.

Commands are defined in `docs/UNDATED--FOUNDATION--UNDATED--FOUNDATION--build-system.md` and become executable once the baseline repository files exist.

## 7. Package / Dependency Management

- Frontend dependencies must be declared in `frontend/package.json` and locked with the selected Node package manager.
- Backend dependencies must be declared in `backend/pyproject.toml`; `requirements.txt` may be maintained as a deployment/install compatibility file if needed.
- Baseline Python dependencies are installed with `python -m pip install -r requirements.txt`.
- Database extensions and migrations must be versioned with the backend/data layer.
- Do not add dependencies merely for convenience.
- Do not commit secrets or local environment files; provide `.env.example`.

## 8. Frontend Stack

### Responsibilities

- Scenario editing and boundary validation.
- API client and frontend models.
- Application state.
- Dashboard, KPI cards, charts, comparison, and time navigation.
- Cesium site/network layers and state rendering.
- Display of assumptions, alerts, simulated/estimated labels, and result explanations.

### Intended modules

```text
frontend/src/api/
frontend/src/types/
frontend/src/state/
frontend/src/components/
frontend/src/cesium/
frontend/src/charts/
```

The frontend constructs a validated scenario request. It must not construct simulation internals or own authoritative energy-model rules.

## 9. Backend Stack

### API/application layer

- FastAPI routes receive HTTP requests and return JSON.
- Pydantic validates request and response contracts.
- Application services orchestrate repositories and simulation execution.

### Simulation layer

The Python simulation domain owns:

- Simulation clock and time-series generation.
- Fleet and charging demand.
- Site and charger models.
- Capacity and utilisation.
- Energy resources.
- Cost calculations.
- Emissions calculations.
- Result aggregation.

Preferred dependency direction:

```text
FastAPI routes -> Application services -> Simulation domain
FastAPI routes -> Application services -> Repository interfaces -> PostgreSQL/PostGIS
```

The simulation domain must not depend on FastAPI, React, CesiumJS, HTTP, or PostgreSQL implementation details.

## 10. Database / Storage

### Primary technologies

- **PostgreSQL** for relational project data, sites, chargers, fleet definitions, assumptions, scenario metadata, and saved simulation metadata where required.
- **PostGIS** for site coordinates, spatial geometry, geographic queries, and future spatial expansion.
- **GeoJSON** for processed spatial exchange and frontend-facing spatial data where appropriate.
- JSON examples and schemas for deterministic baseline scenario/result fixtures.

### Database boundary

The database stores and serves prepared/persistent data. It must not perform the energy simulation. Database access belongs behind repository/data interfaces rather than inside the simulation domain.

Baseline simulation results are held in application memory for the request and are not persisted. The optional `/api/simulations` storage endpoints are deferred.

## 11. Networking / Communication

### Browser to backend

- Producer: React frontend API client.
- Consumer: FastAPI routes.
- Protocol/API: HTTP REST.
- Data format: JSON; GeoJSON for spatial data.
- Direction: request from frontend to backend; response from backend to frontend.
- Required dependency: FastAPI/Pydantic backend and frontend HTTP client.
- Configuration: frontend API base URL and CORS origins.

### Backend to simulation

- Producer: application service.
- Consumer: independent simulation engine/domain.
- Protocol/API: in-process Python interfaces/function calls.
- Data format: typed domain models and `SimulationResult` contract.
- Direction: service submits validated scenario; simulation returns result.
- Required dependency: simulation package/module, not HTTP.
- Configuration: timestep, scenario configuration, and deterministic seed where applicable.

### Backend to database

- Producer: application services/repositories.
- Consumer: PostgreSQL/PostGIS.
- Protocol/API: SQLAlchemy 2 with the psycopg 3 PostgreSQL driver; Alembic manages migrations.
- Data format: relational records and spatial geometry.
- Direction: read/write through repositories.
- Required dependency: PostgreSQL driver and PostGIS-enabled database.
- Configuration: database host, port, name, user, password, and migration setup.

### GIS processing

- Producer: GIS source or synthetic spatial data.
- Consumer: data preparation scripts and PostGIS/frontend spatial records.
- Protocol/API: file processing and database loading.
- Data format: GeoJSON and spatial database records.
- Direction: source -> processing -> database/API/frontend.
- Required dependency: GeoPandas, Shapely, PyProj, and GeoJSON support.
- Configuration: coordinate reference systems and target geography.

### Baseline API surface

The specification proposes placeholders for:

```text
GET  /api/health
GET  /api/sites
GET  /api/sites/{site_id}
GET  /api/fleet
POST /api/simulations
GET  /api/simulations/{simulation_id}
POST /api/scenarios/validate
POST /api/scenarios/simulate
POST /api/scenarios/compare
```

Exact endpoint details and persistence semantics remain subject to the contracts package.

## 12. Rendering / Engine / Graphics Stack

- CesiumJS is the spatial rendering engine for the 3D globe/city view.
- Recharts is the baseline charting library. It consumes result data and does not contain simulation rules.
- The simulation engine is a custom Python time-series domain, not a game engine.
- CesiumJS consumes completed simulation results; it must not calculate authoritative energy, cost, capacity, or emissions rules.

## 13. Cloud / Infrastructure

### Baseline

- Git/GitHub repository.
- Docker and Docker Compose.
- CI pipeline for frontend build, backend tests, simulation tests, and integration checks.
- `.env.example` for configuration.

### Deferred placeholders

- Cloud provider, hosting topology, production ingress, TLS termination, secrets manager, monitoring, and deployment artifact strategy are deferred placeholders.
- Cloud deployment is future scope and must not drive baseline dependencies.

## 14. Testing Technologies

The test stack must verify:

- Python unit tests for clock, charging demand, capacity, cost, emissions, simulation engine, and optional BESS/solar models.
- API and integration tests for frontend/API/simulation/database paths where the environment supports them.
- Deterministic golden fixtures for baseline scenario and result.
- Frontend build/type checks and focused frontend tests as the frontend implementation requires.
- CI checks for dependency installation, builds, tests, and integration boundaries.

The baseline uses pytest for Python and Vitest for frontend unit/component tests. Playwright is deferred until the visual end-to-end workflow exists.

## 15. Development Tools

- Git and GitHub.
- Docker Engine and Docker Compose.
- Python environment/package tooling.
- Node.js and the selected package manager.
- PostgreSQL/PostGIS development tooling.
- Documentation and JSON Schema validation tooling where useful.

## 16. Platform Support

### Required

- Modern desktop browser with WebGL support.
- Windows-compatible local development is required for the current project environment; Docker is the preferred way to reduce host differences.

### Target but not yet fixed

- Linux and macOS developer environments through Docker.
- Browser support is limited to current Chrome/Edge-class desktop browsers with WebGL; a wider matrix is deferred.

## 17. Version Constraints

- Node.js 22 LTS, Python 3.12, PostgreSQL 16, and PostGIS 3.4 are the baseline runtime families.
- React 19, TypeScript 5.7, Vite 6, CesiumJS 1.125, FastAPI 0.115, and Pydantic 2.10 are the initial dependency targets.
- NumPy 2.1, Pandas 2.2, GeoPandas 1.0, Shapely 2.0, and PyProj 3.7 are initial data-library targets.
- Exact patch versions are pinned in `package-lock.json`, `requirements.txt`, and container image references.
- Selected versions must be mutually compatible and support the projectâ€™s target browser/runtime.

## 18. Dependency Constraints

- No live telemetry, MQTT, Kafka, streaming, CPO, traffic, or utility-management dependencies in the baseline.
- No Unity or Unreal dependency.
- No database dependency inside the simulation domain.
- No frontend dependency inside backend or simulation code.
- No raw HTTP calls scattered through React components.
- No feature-driven framework replacement or undocumented major dependency.
- BESS, solar, and managed charging must extend existing simulation interfaces rather than restructure the system.

## 19. Integration Decisions

### React to FastAPI

- Producer: frontend API client.
- Consumer: FastAPI routes.
- Protocol: HTTP REST.
- Format: JSON and GeoJSON.
- Direction: bidirectional request/response.
- Required dependency: React client layer and FastAPI/Pydantic.
- Configuration: API base URL and CORS.

### FastAPI to simulation domain

- Producer: application service.
- Consumer: simulation engine.
- Protocol: in-process Python call/interface.
- Format: validated scenario model and simulation result model.
- Direction: service -> engine -> result.
- Required dependency: simulation package.
- Configuration: timestep, seed, and model assumptions.

### Application services to PostgreSQL/PostGIS

- Producer: repository layer.
- Consumer: database.
- Protocol: PostgreSQL connection/query API.
- Format: relational and spatial records.
- Direction: read/write.
- Required dependency: PostgreSQL driver and PostGIS.
- Configuration: database credentials, host, port, schema, and migrations.

### Simulation result to Cesium/charts

- Producer: backend result response and frontend state.
- Consumer: CesiumJS layers and dashboard/chart components.
- Protocol: frontend in-memory model/state.
- Format: typed result contract; GeoJSON where spatial geometry is exchanged.
- Direction: result -> visualisation.
- Required dependency: shared contract correspondence and CesiumJS.
- Configuration: coordinate system and display mapping.

## 20. Explicitly Forbidden Technologies or Approaches

- Unity or Unreal as the application platform.
- Live telemetry, MQTT, Kafka, streaming analytics, or IoT infrastructure.
- Live CPO, traffic, charging-availability, or utility integrations.
- Utility-grade energy-management or detailed power-grid simulation stacks.
- Detailed battery electrochemistry or photovoltaic-physics engines.
- Replacing the approved frontend/backend/database stack without an architecture decision.
- Letting the frontend or database own authoritative simulation calculations.
- Coupling the simulation domain to HTTP, FastAPI routing, React, CesiumJS, or PostgreSQL internals.

## 21. Technology Risks

- CesiumJS browser/WebGL performance may constrain the number of sites and visual effects.
- GIS-library version compatibility can complicate Windows installation; containerised or locked environments should be preferred.
- PostgreSQL/PostGIS setup adds operational complexity to the baseline.
- Frontend and backend contract drift is possible without shared schemas or contract tests.
- Exact charting, testing, package-manager, and database-access choices remain unspecified.
- Unpinned versions may make the baseline irreproducible.
- The scope of persistence and authentication is not yet defined.

## 22. Unresolved Technology Decisions

- Exact Node.js and Python versions.
- Exact package-manager and lockfile strategy.
- Exact FastAPI/Pydantic major versions.
- Exact PostgreSQL/PostGIS versions.
- Exact dependency versions for CesiumJS and GIS libraries.
- Cloud deployment target, production authentication/authorisation, TLS, and secrets management remain deferred because they do not affect local baseline execution.
- Shared contracts use maintained Pydantic/TypeScript correspondence plus JSON fixtures in the baseline; generated client types are deferred.

## TECH STACK STATUS:
READY

The baseline runtime, package, database, persistence, charting, testing, and CI choices are resolved. Production authentication, cloud deployment, and generated contract tooling remain explicit deferred placeholders and do not block local baseline execution.
