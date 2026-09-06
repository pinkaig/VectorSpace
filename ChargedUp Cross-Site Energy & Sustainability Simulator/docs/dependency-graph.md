# Dependency Graph

## Primary dependency direction

```text
Frontend presentation
    ↓ HTTP/JSON/GeoJSON
API routes and transport schemas
    ↓ typed in-process calls
Application services
    ↓ domain interfaces / repository interfaces
Simulation domain       Data/repository layer
    ↓                         ↓
Pure domain dependencies   PostgreSQL/PostGIS
```

## Detailed graph

```text
frontend/src/components
    -> frontend/src/state
    -> frontend/src/api
    -> frontend/src/types
    -> React / CesiumJS / chart library

backend/app/api
    -> backend/app/schemas
    -> backend/app/services

backend/app/services
    -> backend/app/simulation
    -> backend/app/data/repositories
    -> backend/app/schemas or mapping layer

backend/app/simulation
    -> simulation domain types
    -> clock, fleet, charging, sites, energy, economics, sustainability
    -> NumPy only where justified

backend/app/data/repositories
    -> backend/app/db
    -> PostgreSQL/PostGIS client

scripts and data preparation
    -> GeoPandas / Shapely / PyProj
    -> data files / PostGIS

infra and CI
    -> frontend build
    -> backend packaging
    -> database services
    -> test commands
```

## Allowed dependencies

- Frontend components may depend on frontend state, API clients, types, React, CesiumJS, and approved chart tooling.
- API routes may depend on transport schemas and application services.
- Application services may depend on domain interfaces and repository interfaces.
- Simulation modules may depend on other simulation modules only in the documented domain direction and on pure utilities.
- Repositories may depend on database access and map records to domain types.
- Data preparation may depend on GIS libraries and data storage formats.
- Tests may depend on the component under test and test fixtures.

## Forbidden dependencies

- Simulation domain -> FastAPI, HTTP, React, CesiumJS, PostgreSQL driver, ORM models, or UI state.
- Frontend -> database or server filesystem.
- React components -> raw scattered HTTP calls outside API client modules.
- API routes -> duplicated energy/cost/emissions formulas.
- Database -> simulation engine.
- Cesium/chart layer -> authoritative simulation calculations.
- Core domain -> live telemetry, MQTT, Kafka, CPO, traffic, or utility systems.

## Ownership

- API application owns lifecycle of service composition.
- Simulation engine owns one run's mutable state and returns immutable result data.
- Repositories own database connections and persistence mapping.
- Frontend state owns loaded results and selected timestep only.
- Docker/CI owns process wiring, not application business rules.

## Circular dependency analysis

Potential cycles to avoid:

1. API schemas importing simulation internals while simulation imports API schemas. Resolve with mapping or shared neutral contracts.
2. Simulation models importing repositories while repositories import simulation models. Resolve with repository interfaces and domain-owned types.
3. Frontend types being generated from UI components while API clients depend on those components. Keep types in `frontend/src/types/` or shared contract generation.
4. Comparison service calling simulation service while simulation service calls comparison. Comparison consumes completed results only.
5. Database models leaking into domain models. Map at repository boundary.

No circular dependency is permitted in the baseline without an explicit ADR.

## External dependencies

Primary external dependencies are the approved frontend frameworks, Python web/data/GIS libraries, PostgreSQL/PostGIS, Docker, and CI tooling. Exact versions and some package choices remain unresolved in `techstack.md`.
