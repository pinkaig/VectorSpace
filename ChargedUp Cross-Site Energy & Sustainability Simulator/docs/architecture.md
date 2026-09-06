# Architecture

## Architectural principles

- Keep scope, stack, contracts, and implementation responsibilities separate.
- Keep the simulation domain independent of transport, rendering, and persistence details.
- Validate scenario input at the API boundary and again at the domain boundary.
- Make the same scenario and seed deterministic.
- Establish integration paths in the baseline before advanced feature work.
- Use explicit placeholders for future systems; do not fake completed functionality.
- Stop and report an architectural conflict instead of silently changing a fixed boundary.

## Regions and responsibilities

### Frontend

**Purpose:** Edit scenarios and present simulation results.

**Responsibilities:** scenario controls, UI validation, API client, frontend state, dashboard, charts, comparison views, time navigation, Cesium site/network layers, alerts, and assumption labels.

**Does not own:** authoritative simulation rules, database access, or server-side scenario validity.

**Inputs:** site/fleet data, scenario responses, simulation results, comparison results.

**Outputs:** validated scenario requests and visual state.

**Allowed dependencies:** frontend types, API client, React, CesiumJS, chart library, browser APIs.

**Forbidden dependencies:** direct database access, simulation internals, server-only configuration.

### API and application services

**Purpose:** Expose stable HTTP boundaries and orchestrate use cases.

**Responsibilities:** routing, request/response validation, error mapping, scenario validation, simulation invocation, comparison invocation, repository coordination, and serialization.

**Does not own:** simulation algorithms, rendering, or database schema details.

**Inputs:** HTTP JSON/GeoJSON requests and repository results.

**Outputs:** HTTP JSON/GeoJSON responses and typed calls into domain services.

**Allowed dependencies:** FastAPI, Pydantic, application contracts, domain interfaces, repository interfaces, configuration.

**Forbidden dependencies:** React/Cesium implementation, presentation logic, duplicated simulation formulas.

### Simulation domain

**Purpose:** Execute deterministic cross-site energy scenarios.

**Responsibilities:** clock, fleet demand, charging allocation, site/charger state, capacity/utilisation, energy resources, cost, emissions, result aggregation, and domain validation.

**Does not own:** HTTP, JSON transport, React, CesiumJS, database connections, authentication, or UI formatting.

**Inputs:** validated scenario domain model and simulation configuration.

**Outputs:** typed `SimulationResult` and domain validation errors.

**Allowed dependencies:** standard Python runtime, explicit domain types, NumPy where justified, model interfaces, deterministic utilities.

**Forbidden dependencies:** FastAPI routing, HTTP clients, PostgreSQL drivers, ORM models, React, CesiumJS, UI state.

### Comparison domain/service

**Purpose:** Compare completed results without changing simulation behavior.

**Responsibilities:** align compatible results, calculate absolute/delta/percentage metrics, and report comparison metadata.

**Does not own:** rerunning simulations, scenario mutation, or visual presentation.

**Inputs:** two completed `SimulationResult` values.

**Outputs:** typed `ComparisonResult`.

### Data and GIS

**Purpose:** Prepare and persist synthetic or approved historical data.

**Responsibilities:** repositories, schema/migrations, seed data, GIS transformation, GeoJSON processing, and database connectivity.

**Does not own:** authoritative simulation calculations.

**Allowed dependencies:** PostgreSQL/PostGIS, database access library selected later, GeoPandas, Shapely, PyProj, GeoJSON tooling.

### Infrastructure

**Purpose:** Make the project reproducible and verifiable.

**Responsibilities:** Docker, Compose, environment configuration, CI, build commands, test commands, and documentation.

## Core data flow

```text
User edits scenario
    -> Frontend validates boundary fields
    -> API client sends ScenarioRequest
    -> FastAPI/Pydantic validates transport data
    -> Application service resolves required data
    -> Simulation domain validates and executes scenario
    -> SimulationResult returns to service
    -> API serializes result
    -> Frontend stores result
    -> Charts, KPIs, Cesium, and time controller select result data
```

Normal time playback must select `result[t]`; it must not call the simulation endpoint for every slider position.

## Lifecycle

1. Application starts and loads configuration.
2. API and database connectivity are checked.
3. Baseline data is available through repository boundaries.
4. A scenario request is validated.
5. A simulation run creates an immutable result.
6. Frontend presents and navigates the result.
7. A second result may be compared with the first.
8. Services shut down without domain state being coupled to transport lifecycle.

## Ownership rules

- Frontend owns view state only.
- Application services own orchestration, not domain formulas.
- Simulation engine owns simulation state for one run and produces a result.
- Repositories own persistence translation.
- API schemas own transport representation; domain types own simulation representation.
- Comparison service owns derived differences, not either source result.

## Architectural conflict rule

If implementation requires changing a fixed technology, public contract, dependency direction, region, protocol, or subsystem responsibility:

```text
STOP -> report ARCHITECTURAL CONFLICT -> describe impact -> obtain decision
```

Do not silently work around the planning package.
