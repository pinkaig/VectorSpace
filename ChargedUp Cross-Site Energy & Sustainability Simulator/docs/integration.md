# Integration Plan

## Integration inventory

| Integration | Producer | Consumer | Protocol | Data | Baseline |
|---|---|---|---|---|---|
| Browser to API | React API client | FastAPI routes | HTTP REST | JSON/GeoJSON | Required |
| API to simulation | Application service | Simulation engine | In-process call | Typed domain models | Required |
| Application to database | Repository layer | PostgreSQL/PostGIS | Database client/query API | Relational/spatial records | Required |
| GIS preparation | GIS source/scripts | PostGIS/API/frontend | File processing and database loading | GeoJSON/spatial records | Required for prepared data |
| Result to visualisation | Frontend state | Cesium/charts/KPIs | In-memory application interfaces | Simulation result | Required |
| Scenario A/B comparison | Application service | Comparison service | In-process call/API | Two results | MVP phase |

## React to FastAPI

**Purpose:** Submit validated scenarios and retrieve sites, fleet data, simulation results, and comparisons.

**Producer:** Frontend API modules under `frontend/src/api/`.

**Consumer:** FastAPI route modules under `backend/app/api/`.

**Protocol:** HTTP REST.

**Data:** JSON for normal contracts; GeoJSON for spatial representations where needed.

**Configuration:** frontend API base URL and backend CORS origins through environment configuration.

**Lifecycle:** frontend starts after or alongside backend; health check establishes availability; requests are rejected with structured errors when validation fails.

**Error behavior:** transport errors become frontend request errors; HTTP 4xx represents invalid client/scenario input; HTTP 5xx represents unexpected service failures; domain validation errors must not be flattened into successful results.

**Authentication:** none for the local baseline; production authentication is a deferred placeholder and must be added at the API boundary later.

**Baseline:** health, sites, fleet, scenario validation, simulation placeholder/minimal run, and result response.

## FastAPI to simulation domain

**Purpose:** Keep HTTP orchestration separate from authoritative simulation rules.

**Producer:** application services.

**Consumer:** simulation engine and domain models.

**Protocol:** in-process typed Python calls.

**Data:** validated `Scenario`, `SimulationConfig`, `SimulationResult`, and domain errors.

**Direction:** service submits scenario/configuration; engine returns immutable result or typed validation/execution error.

**Lifecycle:** construct engine/service at application startup or per request according to the selected implementation; each run has isolated state; result remains available to the caller after completion.

**Error behavior:** invalid scenario/configuration is rejected before timestep execution; runtime model errors are reported as failures and do not produce partial successful results unless a contract explicitly supports partial results.

**Baseline:** deterministic stub or minimal engine returning canonical 24-hour result data.

## Application to PostgreSQL/PostGIS

**Purpose:** Load sites, chargers, fleet definitions, assumptions, and prepared spatial data.

**Producer:** repository/data access layer.

**Consumer:** PostgreSQL/PostGIS.

**Protocol:** SQLAlchemy 2 with the psycopg 3 driver; Alembic manages migrations.

**Data:** relational entities and spatial geometry.

**Direction:** read/write through repositories; simulation domain receives domain data rather than database objects.

**Lifecycle:** configuration and connection initialization at service startup; migrations/seed process before dependent endpoints; clean shutdown releases connections.

**Error behavior:** unavailable database prevents dependent operations and produces a clear readiness failure; the simulation domain remains independently testable with in-memory data.

**Authentication:** local database credentials supplied through environment configuration; production secret management is deferred.

**Baseline:** health/readiness path and at least one repository/data path sufficient to prove connectivity.

## GIS processing to PostGIS/API/Cesium

**Purpose:** Transform source or synthetic positions into consistent spatial records.

**Producer:** preparation scripts using GeoPandas, Shapely, and PyProj.

**Consumer:** PostGIS, API schemas, and Cesium-facing frontend data.

**Protocol:** file processing/database loading and HTTP JSON/GeoJSON.

**Data:** GeoJSON and spatial database records with documented coordinate assumptions.

**Error behavior:** invalid geometry, missing coordinates, or CRS mismatch fails data preparation rather than silently producing map output.

**Baseline:** synthetic site positions and a documented coordinate convention.

## Simulation result to frontend visualisation

**Purpose:** Drive KPIs, charts, alerts, site state, and time playback from one completed result.

**Producer:** API response stored in frontend state.

**Consumer:** dashboard, charts, Cesium layers, comparison view, and time controller.

**Protocol:** in-memory typed frontend data flow.

**Data:** `SimulationResult`, site time-series, network metrics, sustainability metrics, and spatial site metadata.

**Direction:** result -> selected timestep -> visual components.

**Lifecycle:** result is loaded once; the time controller selects existing indices; rerunning occurs only when the user submits a new scenario.

**Baseline:** a deterministic result can render baseline sites, KPIs, and a time index.

## API surface

The following endpoints are proposed boundaries and require final contract definitions in `UNDATED--FOUNDATION--UNDATED--FOUNDATION--contracts.md`:

```text
GET  /api/health
GET  /api/sites
GET  /api/sites/{site_id}
GET  /api/fleet
POST /api/scenarios/validate
POST /api/scenarios/simulate
POST /api/scenarios/compare
POST /api/simulations
GET  /api/simulations/{simulation_id}
```

`/api/simulations` persistence endpoints are deferred. The baseline uses `POST /api/scenarios/simulate` with in-memory results and does not require simulation-result storage.

## Integration change rule

A new protocol, external service, major dependency, or cross-region direction must be added to this document and the relevant contract/dependency documents before implementation.
