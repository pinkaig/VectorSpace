# GAM300 Project 3 — Energy & Sustainability Simulator
## Master Project Context, Technical Scope, Repository Baseline & Development Phases

> **Purpose:** This document defines the initial technical baseline for Project 3 so future agents can implement functionality without repeatedly redesigning the architecture or retrofitting integrations.
>
> **Core principle:** establish the application boundaries, technology stack, interfaces, data contracts, build system, deployment structure, and integration points **before feature implementation**. Features should be added inside these boundaries rather than introducing new stacks later.

---

# 1. Project Context

## 1.1 Project

**GAM300 — Project 3: Cross-Site Energy & Sustainability Simulator**

Industry context:

- ChargedUp / Upsight
- Intended as a concept that could eventually contribute to the ChargedUp Nexus platform.
- Browser-based application.
- Not a Unity or Unreal project.
- Simulation product rather than a visual-only demo.

The source brief describes the application as a decision-support simulation: the user changes assumptions/decisions and observes how energy demand, cost, infrastructure utilisation, site constraints and emissions change.

The project is explicitly scoped toward a **small network and manageable number of variables**, not a utility-grade energy-management system.

---

# 2. Core User Question

> **If my fleet charges across depots and external sites, what happens to energy demand, cost, infrastructure utilisation and emissions?**

The central scenario is:

```text
Fleet
  ↓
Charging decisions
  ↓
Multiple sites
  ↓
Time-dependent demand
  ↓
Energy / capacity / cost / emissions
  ↓
Visualise consequences
  ↓
Compare scenarios
```

The application should make the consequences of charging timing and allocation visible.

Example:

```text
Scenario A
20 EVs charge around 18:00
        ↓
Depot peak rises
        ↓
Capacity constraint
        ↓
Higher peak exposure / possible violation

Scenario B
Same vehicles
Charging shifted overnight
        ↓
Lower peak
        ↓
No capacity violation
```

The purpose is not to find a mathematically perfect global optimum. The purpose is to make cross-site consequences understandable and explorable.

---

# 3. What the System Is

## 3.1 System classification

The system should be treated as:

> **Preprocessed/static data + runtime scenario simulation + real-time interactive visualization.**

It is **not** primarily:

- live telemetry infrastructure
- telemetry playback
- streaming analytics
- real-time sensor ingestion
- utility-grade energy management
- continuously running physical-world simulation

### Runtime model

```text
Static / prepared data
        ↓
Scenario configuration
        ↓
Runtime simulation
        ↓
24-hour time-series results
        ↓
Interactive visualization
```

The simulation remains a runtime component because changing scenario inputs must change the result.

The visualization is interactive and should feel responsive, but this does not imply live external telemetry.

---

# 4. Source Requirements

## 4.1 Mandatory application characteristics

The application must provide:

- Browser-based application.
- Simulation clearly identified as simulated.
- Synthetic or historical data unless approved real data is supplied.
- User-editable assumptions.
- Scenario-driven interaction.
- Results that change when inputs change.
- Explainable results.
- Scenario / before-and-after comparison.
- Custom-built simulation component.
- Interactive spatial / dashboard visualization.

## 4.2 Project 3 functional scope

The application should support a small network containing:

- one or more fleet depots
- several external charging sites / CPOs
- EV fleet
- chargers
- site power limits
- electricity / charging prices
- charging schedules
- optional BESS
- optional solar / renewable generation
- emissions assumptions

The source brief identifies these core inputs and outputs directly.

---

# 5. Functional Scope

## 5.1 Fleet

Baseline:

- Number of vehicles.
- EV electrification percentage.
- Charging energy requirement.
- Charging windows.
- Depot assignment.

Example:

```text
Fleet size: 100
EV share: 50%
EVs: 50
```

The exact fleet model should remain intentionally simple.

---

## 5.2 Charging Sites

Each site should support:

```text
Site
├── id
├── name
├── type
│   ├── depot
│   └── external / CPO
├── geographic position
├── operating hours
├── power limit
├── electricity / charging price
└── chargers[]
```

Each charger should support at minimum:

```text
Charger
├── id
├── power_kW
├── availability
└── site_id
```

---

## 5.3 Charging Demand

The model should represent demand over a day.

Baseline time model:

```text
00:00 → 24:00
```

Recommended initial timestep:

```text
15 minutes
```

This creates:

```text
24 hours × 4
= 96 timesteps
```

The timestep should be a simulation configuration value rather than a hard-coded assumption.

---

# 6. Simulation Model

## 6.1 Simulation responsibility

The custom-built RTIS component owns:

- Cross-site energy model.
- Site-capacity logic.
- Cost calculations.
- Optional BESS logic.
- Emissions calculation engine.
- Simulation state / time-series generation.

This is the core technical contribution of the project.

---

## 6.2 Simulation flow

```text
SimulationScenario
        ↓
Validate inputs
        ↓
Initialize fleet
        ↓
Initialize sites
        ↓
Initialize chargers
        ↓
Initialize energy resources
        ↓
Generate / assign charging demand
        ↓
Iterate simulation timesteps
        ↓
Calculate site load
        ↓
Calculate capacity utilization
        ↓
Calculate constraint violations
        ↓
Calculate energy cost
        ↓
Apply BESS / solar if enabled
        ↓
Calculate emissions
        ↓
Aggregate network results
        ↓
Produce SimulationResult
```

---

# 7. Time-Series Simulation

The core simulation should produce a result indexed by time.

Conceptually:

```text
Time
 │
 ├── 00:00
 ├── 00:15
 ├── 00:30
 ├── ...
 ├── 18:00
 ├── ...
 └── 23:45
```

For each site:

```text
SiteState[t]
├── demand_kW
├── energy_kWh
├── utilization
├── cost
├── capacity_limit_kW
├── capacity_exceeded
├── grid_import_kW
├── solar_generation_kW
└── bess_power_kW
```

The model should preserve enough information to reconstruct the visual state at any time index.

---

# 8. Simulation Result Model

Recommended conceptual contract:

```text
SimulationResult
├── scenario_id
├── timestep
├── start_time
├── end_time
├── timestamps[]
├── sites[]
│   ├── site_id
│   ├── load_kW[]
│   ├── energy_kWh[]
│   ├── utilization[]
│   ├── cost[]
│   ├── capacity_limit_kW
│   ├── capacity_exceeded[]
│   ├── grid_import_kW[]
│   ├── solar_generation_kW[]
│   └── bess_power_kW[]
├── network
│   ├── total_energy_kWh
│   ├── peak_demand_kW
│   ├── peak_time
│   ├── total_cost
│   ├── total_emissions
│   └── fuel_displaced
└── sustainability
    ├── electricity_consumption
    ├── emissions
    ├── ICE_baseline_emissions
    └── emissions_reduction
```

The exact serialized API representation can evolve, but the separation between **scenario input** and **simulation result** should remain.

---

# 9. Cost Model

The initial model should support:

- Depot electricity price.
- External CPO charging tariff.
- Optional peak / off-peak pricing.

Core calculations:

```text
energy_cost
peak_cost / demand-related exposure
total_site_cost
total_network_cost
```

The project should expose assumptions clearly.

Do not initially attempt to reproduce every real-world tariff structure.

---

# 10. Capacity Model

Each site has a physical power limit.

```text
site_load_kW
        │
        ▼
site_capacity_kW
        │
        ├── load < capacity → normal
        │
        └── load > capacity → constraint / violation
```

Useful derived values:

```text
utilization = load / capacity

capacity_exceeded =
    load > capacity
```

The visual layer should make violations immediately obvious.

---

# 11. Emissions Model

The project should treat sustainability as **indicative simulation output**, not a complete sustainability-accounting platform.

Inputs:

- Electricity emissions factor.
- ICE / diesel baseline assumptions.
- Fuel displaced.
- Electricity consumed.
- Reporting period.
- Renewable contribution where modelled.

Outputs:

- Estimated electricity consumption.
- Fuel displaced.
- Estimated GHG emissions.
- Emissions reduction compared with ICE baseline.
- Indicative Scope 1 / Scope 2 impacts.
- Simple relevant Scope 3 view where appropriate.

Important:

```text
Emissions result
        ↓
Estimate
        ↓
Based on explicit assumptions
```

The UI should show the assumptions behind sustainability results.

---

# 12. Optional Energy Resources

## 12.1 BESS

BESS should be implemented behind an isolated simulation component:

```text
BESSModel
├── capacity_kWh
├── max_charge_kW
├── max_discharge_kW
├── efficiency
└── state_of_charge
```

Its purpose is to demonstrate:

- peak reduction
- energy shifting
- site capacity relief

It should not become a full battery-management system.

## 12.2 Solar

Solar should initially be represented as a simple time-dependent generation profile:

```text
solar_generation[t]
```

It can reduce grid import.

Do not initially build detailed photovoltaic physics.

---

# 13. Scenario System

Scenario configuration should be a first-class object.

```text
Scenario
├── fleet
├── sites
├── charging_strategy
├── pricing
├── energy_resources
├── sustainability
└── simulation_config
```

Example:

```json
{
  "fleet": {
    "totalVehicles": 100,
    "evPercentage": 50
  },
  "chargingStrategy": {
    "depotShare": 0.8,
    "externalShare": 0.2,
    "chargingWindow": "18:00-23:00"
  }
}
```

The frontend should never construct simulation internals directly.

It constructs a **validated scenario request**.

---

# 14. Scenario Comparison

Comparison is a core feature, not a late add-on.

The architecture must support:

```text
Scenario A
    ↓
SimulationResult A

Scenario B
    ↓
SimulationResult B

        ↓

ComparisonResult
```

Potential comparison values:

- total energy
- network peak
- peak time
- total cost
- depot cost
- external charging cost
- utilization
- capacity violations
- emissions
- emissions reduction
- charging share

The comparison layer should be independent from the simulation engine.

---

# 15. Time Control Architecture

The time slider should operate on simulation results.

Preferred architecture:

```text
RUN SCENARIO
      ↓
Simulation executes 00:00 → 24:00
      ↓
SimulationResult
      ↓
Frontend stores result
      ↓
TIME SLIDER
      ↓
Select result[t]
      ↓
Update:
    ├── Cesium site state
    ├── charts
    ├── KPI cards
    └── alerts
```

Avoid:

```text
time slider
   ↓
rerun backend simulation
   ↓
return one timestep
```

for normal playback.

This keeps playback deterministic and inexpensive.

---

# 16. Frontend Stack

## Primary

```text
TypeScript
React
CesiumJS
```

## Responsibilities

### TypeScript

- application logic
- API client
- shared frontend models
- state
- validation at UI boundary
- visualization orchestration

### React

- component architecture
- scenario controls
- dashboard
- application state integration
- result presentation

### CesiumJS

- 3D globe / city view
- site positions
- site visualization
- network spatial context
- time-dependent visual state

---

# 17. Backend Stack

## Primary

```text
Python
FastAPI
Pydantic
```

Responsibilities:

```text
FastAPI
├── API routing
├── request validation
├── scenario execution
├── result serialization
└── API errors

Pydantic
├── ScenarioRequest
├── ScenarioResponse
├── SimulationResult
├── Site
├── Charger
└── API contracts
```

The simulation engine should remain separate from FastAPI.

Preferred dependency direction:

```text
FastAPI
   ↓
Application / Services
   ↓
Simulation Domain
```

not:

```text
Simulation
   ↓
FastAPI
```

The simulation must be executable independently of HTTP.

---

# 18. Database Stack

## Primary

```text
PostgreSQL
PostGIS
```

Responsibilities:

### PostgreSQL

- persistent scenario-independent data
- sites
- chargers
- fleet definitions
- assumptions
- scenario metadata
- saved simulation metadata where required

### PostGIS

- site coordinates
- spatial geometry
- geographic queries
- future spatial expansion

Do not make the database responsible for performing the energy simulation.

---

# 19. GIS / Data Stack

Recommended Python libraries:

```text
GeoPandas
Shapely
PyProj
```

Responsibilities:

### GeoPandas

- GIS dataset preparation
- GeoJSON processing
- spatial data preparation

### Shapely

- geometry operations

### PyProj

- coordinate reference system transformations

### GeoJSON

Primary exchange format for spatial data.

---

# 20. Numerical / Data Processing Stack

```text
NumPy
Pandas
```

Use:

### NumPy

- numerical arrays
- time-series calculations
- efficient numeric operations

### Pandas

- data preparation
- time-series tables
- synthetic dataset generation
- analysis/debugging

The core simulation should not become dependent on Pandas dataframes internally unless that is genuinely useful. Keep the domain model explicit.

---

# 21. API / Integration Contract

The integration architecture must exist before feature implementation.

```text
React
  │
  │ HTTP / JSON
  ▼
FastAPI
  │
  ▼
Application Service
  │
  ▼
Simulation Engine
  │
  ├── Domain Models
  ├── Charging Model
  ├── Site Model
  ├── Cost Model
  ├── Capacity Model
  ├── BESS Model
  └── Emissions Model
```

---

# 22. API Baseline

The initial API should provide placeholders for:

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

The exact endpoints may be refined during implementation, but the integration surface should be established early.

---

# 23. Frontend API Client

Never scatter raw `fetch()` calls throughout React components.

Create:

```text
frontend/src/api/
├── client.ts
├── healthApi.ts
├── sitesApi.ts
├── scenariosApi.ts
├── simulationsApi.ts
└── comparisonApi.ts
```

All backend communication passes through this layer.

---

# 24. Shared Contracts

Where practical, maintain a clear correspondence between backend Pydantic models and frontend TypeScript types.

```text
Backend
Pydantic
    │
    │ JSON
    ▼
Frontend
TypeScript interfaces
```

Example:

```text
ScenarioRequest
SimulationResult
Site
Charger
ScenarioComparison
```

The frontend should not infer undocumented backend structures.

---

# 25. Repository Layout

Recommended baseline:

```text
project-root/
│
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Makefile
│
├── docs/
│   ├── project-context.md
│   ├── architecture.md
│   ├── simulation-model.md
│   ├── api-contract.md
│   ├── data-model.md
│   ├── gis-data.md
│   ├── deployment.md
│   └── decisions/
│       ├── ADR-001-stack.md
│       ├── ADR-002-simulation-boundary.md
│       ├── ADR-003-api-boundary.md
│       └── ADR-004-time-series-model.md
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       │
│       ├── api/
│       │   ├── client.ts
│       │   ├── healthApi.ts
│       │   ├── sitesApi.ts
│       │   ├── scenariosApi.ts
│       │   ├── simulationsApi.ts
│       │   └── comparisonApi.ts
│       │
│       ├── types/
│       │   ├── scenario.ts
│       │   ├── simulation.ts
│       │   ├── site.ts
│       │   ├── charger.ts
│       │   └── comparison.ts
│       │
│       ├── state/
│       │   ├── scenarioStore.ts
│       │   ├── simulationStore.ts
│       │   └── viewStore.ts
│       │
│       ├── components/
│       │   ├── scenario/
│       │   │   ├── FleetControls.tsx
│       │   │   ├── ChargingControls.tsx
│       │   │   ├── SiteControls.tsx
│       │   │   ├── EnergyControls.tsx
│       │   │   └── SustainabilityControls.tsx
│       │   │
│       │   ├── dashboard/
│       │   │   ├── KPIGrid.tsx
│       │   │   ├── CostPanel.tsx
│       │   │   ├── CapacityPanel.tsx
│       │   │   └── EmissionsPanel.tsx
│       │   │
│       │   ├── timeline/
│       │   │   ├── TimeSlider.tsx
│       │   │   └── TimelineControls.tsx
│       │   │
│       │   ├── comparison/
│       │   │   ├── ScenarioComparison.tsx
│       │   │   └── ComparisonCharts.tsx
│       │   │
│       │   └── common/
│       │
│       ├── cesium/
│       │   ├── CesiumViewer.ts
│       │   ├── SiteLayer.ts
│       │   ├── NetworkLayer.ts
│       │   ├── SiteStateRenderer.ts
│       │   └── CesiumTimeController.ts
│       │
│       ├── charts/
│       │   ├── LoadChart.tsx
│       │   ├── CostChart.tsx
│       │   ├── UtilizationChart.tsx
│       │   └── EmissionsChart.tsx
│       │
│       └── utils/
│
├── backend/
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       │
│       ├── api/
│       │   ├── health.py
│       │   ├── sites.py
│       │   ├── scenarios.py
│       │   ├── simulations.py
│       │   └── comparisons.py
│       │
│       ├── schemas/
│       │   ├── scenario.py
│       │   ├── simulation.py
│       │   ├── site.py
│       │   ├── charger.py
│       │   └── comparison.py
│       │
│       ├── services/
│       │   ├── scenario_service.py
│       │   ├── simulation_service.py
│       │   └── comparison_service.py
│       │
│       ├── simulation/
│       │   ├── engine.py
│       │   ├── clock.py
│       │   ├── state.py
│       │   │
│       │   ├── fleet/
│       │   │   ├── fleet_model.py
│       │   │   └── charging_demand.py
│       │   │
│       │   ├── sites/
│       │   │   ├── site_model.py
│       │   │   ├── capacity.py
│       │   │   └── charger_model.py
│       │   │
│       │   ├── energy/
│       │   │   ├── energy_model.py
│       │   │   ├── bess.py
│       │   │   └── solar.py
│       │   │
│       │   ├── economics/
│       │   │   └── cost_model.py
│       │   │
│       │   └── sustainability/
│       │       └── emissions.py
│       │
│       ├── data/
│       │   ├── repositories/
│       │   │   ├── site_repository.py
│       │   │   └── fleet_repository.py
│       │   └── seed/
│       │
│       ├── db/
│       │   ├── connection.py
│       │   ├── models.py
│       │   └── migrations/
│       │
│       └── config/
│           └── settings.py
│
├── shared/
│   ├── schemas/
│   │   ├── scenario.schema.json
│   │   ├── simulation-result.schema.json
│   │   └── site.schema.json
│   └── examples/
│       ├── baseline-scenario.json
│       └── baseline-result.json
│
├── data/
│   ├── raw/
│   ├── processed/
│   ├── synthetic/
│   └── README.md
│
├── scripts/
│   ├── seed_database.py
│   ├── generate_synthetic_data.py
│   ├── validate_gis_data.py
│   └── run_simulation.py
│
├── tests/
│   ├── backend/
│   │   ├── simulation/
│   │   ├── api/
│   │   └── data/
│   ├── frontend/
│   └── integration/
│
├── infra/
│   ├── docker/
│   │   ├── frontend.Dockerfile
│   │   └── backend.Dockerfile
│   ├── nginx/
│   └── cloud/
│
└── .github/
    └── workflows/
        ├── ci.yml
        └── build.yml
```

---

# 26. Architectural Regions

The repository should be treated as four major regions.

## REGION A — Frontend

```text
frontend/
```

Owns:

- user interaction
- scenario editing
- visualization
- dashboard
- time navigation
- comparison presentation
- API client
- frontend state

Does **not** own:

- authoritative simulation calculations
- database access
- energy model rules

---

## REGION B — Backend / Application

```text
backend/app/api/
backend/app/services/
```

Owns:

- HTTP API
- request validation
- orchestration
- persistence coordination
- simulation execution requests

Does **not** own the actual visualization.

---

## REGION C — Simulation Domain

```text
backend/app/simulation/
```

Owns:

- simulation clock
- fleet demand
- charging
- site capacity
- energy
- cost
- BESS
- solar
- emissions
- result generation

This is the primary RTIS region.

It should be executable independently of the web server.

---

## REGION D — Data / Infrastructure

```text
data/
backend/app/db/
infra/
.github/
```

Owns:

- PostgreSQL
- PostGIS
- synthetic data
- GIS preprocessing
- Docker
- CI/CD
- deployment

---

# 27. Dependency Direction

Maintain this direction:

```text
                    FRONTEND
                       │
                    HTTP/JSON
                       │
                       ▼
                     API
                       │
                       ▼
                 APPLICATION
                   SERVICES
                       │
                       ▼
                 SIMULATION
                    DOMAIN
                       │
              ┌────────┴────────┐
              ▼                 ▼
             DATA              CONFIG
```

The simulation domain should not depend on:

- React
- CesiumJS
- FastAPI routing
- HTTP
- PostgreSQL implementation details

This keeps the custom simulation component testable and reusable.

---

# 28. Integration Points Must Exist Early

The following interfaces should be established during the initial foundation phase:

```text
[Frontend]
    │
    ├── API client
    │
    ▼
[FastAPI]
    │
    ├── Pydantic contracts
    │
    ▼
[Application Service]
    │
    ▼
[Simulation Engine]
    │
    ├── Domain models
    ├── Cost model
    ├── Capacity model
    ├── Emissions model
    ├── BESS interface
    └── Solar interface
    │
    ▼
[Result Contract]
    │
    ▼
[Frontend]
    │
    ├── Dashboard
    ├── Charts
    └── Cesium
```

Database:

```text
FastAPI / Services
        │
        ▼
Repository interface
        │
        ▼
PostgreSQL/PostGIS
```

GIS:

```text
GIS source
    ↓
GeoPandas / Shapely / PyProj
    ↓
Processed GeoJSON / spatial records
    ↓
PostGIS
    ↓
FastAPI
    ↓
CesiumJS
```

---

# 29. Baseline Project Requirement

Before implementing feature work, the repository should be capable of:

```text
1. Start frontend
2. Start backend
3. Start PostgreSQL/PostGIS
4. Establish frontend → backend connectivity
5. Establish backend → database connectivity
6. Establish backend → simulation connectivity
7. Return a baseline simulation result
8. Render baseline sites in Cesium
9. Display baseline KPIs
10. Move a time slider across baseline results
11. Run a second scenario
12. Compare scenario A and B
```

This is the **foundation definition of done**.

A future agent should not be asked to build a feature before this baseline exists.

---

# 30. Baseline Scenario

Create one canonical scenario:

```text
Scenario: baseline
```

Example:

```text
Fleet
    100 total vehicles
    50% EV

Sites
    Depot A
    Depot B
    External CPO A
    External CPO B

Charging
    Depot-heavy distribution
    Evening charging peak

Simulation
    24 hours
    15-minute timestep

Energy
    Grid only

BESS
    Disabled

Solar
    Disabled

Sustainability
    Fixed electricity emissions factor
    Fixed ICE baseline
```

The exact numerical values are synthetic placeholders and should be documented as such.

The purpose is not realism at this stage.

The purpose is to validate the entire pipeline.

---

# 31. Baseline Vertical Slice

The first working product should prove:

```text
User
 ↓
React
 ↓
POST /api/scenarios/simulate
 ↓
Pydantic validation
 ↓
SimulationService
 ↓
SimulationEngine
 ↓
24-hour simulation
 ↓
SimulationResult
 ↓
JSON
 ↓
React
 ↓
Cesium + charts + KPIs
```

This should exist before advanced simulation behaviour.

---

# 32. Development Phases

# Phase 0 — Project Definition

### Objectives

- Confirm project scope.
- Confirm team roles.
- Confirm approved stack.
- Confirm library/license policy.
- Confirm browser-based architecture.
- Confirm project data policy.
- Confirm target geography / synthetic dataset.
- Confirm IP / handoff expectations.

### Deliverables

```text
Project context
Architecture
Technology decision record
Initial repository
Initial backlog
```

---

# Phase 1 — Foundation & Integration

**Most important architecture phase.**

### Build everything necessary to prevent future retrofitting.

Implement:

- Git repository.
- Frontend project.
- Backend project.
- Database.
- PostGIS.
- Docker Compose.
- Environment configuration.
- CI.
- Frontend ↔ backend API client.
- Backend ↔ database connection.
- Pydantic contracts.
- Simulation engine interface.
- Result schema.
- Cesium initialization.
- Charting placeholder.
- Scenario state placeholder.
- Time controller placeholder.

### Required milestone

```text
Browser
  ↓
React
  ↓
FastAPI
  ↓
Simulation stub
  ↓
JSON result
  ↓
Cesium
```

and:

```text
FastAPI
  ↓
PostgreSQL/PostGIS
```

must already work.

No later feature should need to introduce a fundamental communication path.

---

# Phase 2 — Data Foundation

Implement:

- synthetic fleet dataset
- synthetic site dataset
- charger dataset
- site coordinates
- power limits
- electricity prices
- CPO tariffs
- emissions assumptions
- charging windows

GIS preparation:

```text
Raw GIS
 ↓
GeoPandas
 ↓
Shapely / PyProj
 ↓
Processed data
 ↓
PostGIS / GeoJSON
```

### Deliverable

A complete baseline dataset that the simulation can consume.

---

# Phase 3 — Core Simulation MVP

Implement only the essential simulation:

```text
Fleet
 ↓
Charging demand
 ↓
Site allocation
 ↓
Site load
 ↓
Capacity
 ↓
Cost
 ↓
Emissions
 ↓
24-hour result
```

Required:

- simulation clock
- fleet demand model
- site model
- charger model
- capacity calculation
- cost calculation
- emissions calculation
- result aggregation

Do not start with BESS or solar.

---

# Phase 4 — End-to-End MVP

Connect the actual simulation to the application.

User should be able to:

1. Load baseline.
2. Modify EV percentage.
3. Modify charging timing.
4. Modify site allocation.
5. Run simulation.
6. See results.
7. Scrub through time.
8. See site states change.
9. See capacity warnings.
10. Compare against baseline.

This is the primary **Milestone 3 MVP target**.

---

# Phase 5 — Visualization & Explanation

Improve:

- 3D site representation.
- Load encoding.
- Capacity encoding.
- Utilization visualization.
- Timeline.
- Network overview.
- Cost charts.
- Energy charts.
- Emissions charts.
- Capacity alerts.
- Scenario comparison.

The user should be able to understand the result without inspecting raw data.

---

# Phase 6 — Scenario Comparison

Formalize:

```text
Scenario A
Scenario B
     ↓
Comparison Engine
     ↓
Difference
```

Implement:

- KPI comparison.
- peak comparison.
- cost comparison.
- utilization comparison.
- constraint comparison.
- emissions comparison.
- before/after visualization.

---

# Phase 7 — Progressive Sophistication

Only after the MVP is stable:

### Optional BESS

```text
BESS
 ↓
Peak shaving
 ↓
Capacity effect
 ↓
Cost effect
```

### Optional Solar

```text
Solar
 ↓
Generation profile
 ↓
Reduced grid import
 ↓
Cost / emissions effect
```

### Optional managed charging

```text
Unmanaged
      ↓
Peak-aware scheduling
      ↓
Managed scenario
```

These should plug into existing simulation interfaces rather than restructure the system.

---

# Phase 8 — Polish & Commercial Presentation

Implement:

- UX refinement.
- Visual polish.
- Better explanations.
- Scenario presets.
- Error handling.
- Loading states.
- Empty states.
- Assumption visibility.
- Simulation labels.
- Documentation.
- Demo scenario.

The application should communicate:

```text
Input
 ↓
Assumption
 ↓
Simulation
 ↓
Result
 ↓
Business consequence
```

---

# Phase 9 — Validation & Handoff

Validate:

### Technical

- unit tests
- integration tests
- API tests
- simulation determinism
- scenario reproducibility
- database integrity
- GIS correctness

### Simulation

- energy conservation
- site capacity behaviour
- charging allocation
- cost calculations
- emissions calculations
- BESS behaviour if enabled

### Product

- scenario changes visibly change results
- comparisons are understandable
- assumptions are visible
- outputs are clearly labelled estimates/simulations

### Handoff

- architecture documentation
- setup instructions
- deployment instructions
- data documentation
- API documentation
- simulation documentation
- known limitations
- extension points

---

# 33. Feature Priority

## Tier 0 — Architecture

```text
Repository
Frontend
Backend
Database
Docker
API
Contracts
Simulation interface
Cesium
Charts
CI
```

## Tier 1 — MVP

```text
Fleet
Sites
Chargers
24-hour simulation
Demand
Capacity
Cost
Emissions
Scenario controls
Time slider
3D visualization
Comparison
```

## Tier 2 — Strong Product

```text
Better visual encoding
Managed charging
Scenario presets
Improved explanation
Advanced comparisons
```

## Tier 3 — Stretch

```text
BESS
Solar
Sensitivity analysis
Richer datasets
Advanced scenario logic
```

---

# 34. Explicit Non-Goals

Do not allow future agents to silently expand the project into:

- live telemetry platform
- IoT platform
- MQTT infrastructure
- Kafka / streaming architecture
- utility-grade energy management
- detailed power-grid physics
- detailed electrical engineering simulation
- full sustainability accounting platform
- full carbon accounting platform
- real-time sensor ingestion
- live CPO integrations
- live traffic
- live charging availability
- complex AI optimisation unless explicitly approved
- detailed battery electrochemistry
- full photovoltaic physics
- production-grade financial accounting

These may be future product directions, but they are outside the initial project baseline.

---

# 35. Extension Rules

Future agents must follow these rules.

## Rule 1 — Extend existing boundaries

If adding BESS:

```text
simulation/energy/bess.py
```

not a new backend subsystem.

## Rule 2 — Preserve API contracts

New functionality should extend existing schemas rather than create parallel APIs.

## Rule 3 — Preserve simulation independence

Simulation code must remain runnable without FastAPI.

## Rule 4 — Preserve visualization independence

Cesium should consume simulation results rather than implement simulation rules.

## Rule 5 — No feature-driven stack additions

Do not introduce a new framework/library simply because a feature is being implemented.

First determine whether the existing architecture already supports the feature.

## Rule 6 — Integration before functionality

If a future feature requires a new subsystem, its interface must be established first, even if the initial implementation is a stub.

Example:

```text
BESS interface
    ↓
NullBESS / DisabledBESS
```

Then later:

```text
Real BESS model
```

This avoids retrofitting the simulation engine.

---

# 36. Placeholder Interfaces

Create extension points early.

Example conceptual interfaces:

```text
EnergyResource
├── GridResource
├── BESSResource
└── SolarResource
```

```text
ChargingStrategy
├── UnmanagedCharging
└── ManagedCharging
```

```text
CostModel
├── FlatRateCost
└── TimeOfUseCost
```

```text
EmissionsModel
└── GridAndICEBaselineModel
```

```text
DataProvider
├── SyntheticDataProvider
└── HistoricalDataProvider
```

The first implementation can be simple.

The interface exists so future agents do not have to restructure the system.

---

# 37. Testing Architecture

## Unit tests

Focus on the simulation domain:

```text
test_clock
test_charging_demand
test_site_capacity
test_cost_model
test_emissions
test_bess
test_solar
test_simulation_engine
```

## Integration tests

```text
Frontend
   ↓
API
   ↓
Simulation
   ↓
Database
```

Test the complete request path.

## Golden baseline

Maintain:

```text
shared/examples/baseline-scenario.json
shared/examples/baseline-result.json
```

The baseline result can be used as a deterministic regression fixture.

---

# 38. Determinism

The simulation should be deterministic for the same scenario.

```text
Scenario A
    ↓
Simulation
    ↓
Result A

Scenario A
    ↓
Simulation
    ↓
Result A
```

If randomness is introduced later:

```text
Scenario
+
Seed
 ↓
Deterministic simulation
```

The seed should be part of the simulation configuration.

This is important for:

- debugging
- testing
- comparison
- demonstrations
- reproducibility

---

# 39. Error Boundaries

Errors should remain localized.

```text
Frontend validation
        ↓
API validation
        ↓
Domain validation
        ↓
Simulation
        ↓
Result
```

Invalid examples:

- EV percentage outside 0–100%.
- Negative charger power.
- Negative site capacity.
- Charging split not summing correctly.
- Invalid operating hours.
- Invalid site reference.
- Invalid timestep.

Do not let invalid scenario data reach the simulation core.

---

# 40. Environment Structure

Use environment configuration from the beginning.

```text
.env.example
```

Potential variables:

```text
APP_ENV=
API_HOST=
API_PORT=

DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=

CORS_ORIGINS=

VITE_API_BASE_URL=
```

No secrets should be committed.

---

# 41. Local Development

Preferred local topology:

```text
Browser
   │
   ▼
Frontend container / dev server
   │
   ▼
Backend container / dev server
   │
   ▼
PostgreSQL + PostGIS
```

Docker Compose should establish the baseline network.

A new developer should be able to clone the repository and start the baseline system with a documented command.

---

# 42. CI Baseline

CI should exist before substantial feature work.

Minimum:

```text
Push
 ↓
Install dependencies
 ↓
Frontend build
 ↓
Backend tests
 ↓
Simulation tests
 ↓
Integration checks
```

Later:

```text
 ↓
Docker build
 ↓
Deployment artifact
```

---

# 43. Documentation Structure

Maintain:

```text
docs/
├── project-context.md
├── architecture.md
├── simulation-model.md
├── api-contract.md
├── data-model.md
├── gis-data.md
├── deployment.md
└── decisions/
```

Every major architectural decision should have a short ADR.

---

# 44. Architecture Decision Summary

## Decision A — Browser application

```text
React + TypeScript
```

Reason:

The project is explicitly a browser-based application.

## Decision B — 3D/GIS

```text
CesiumJS
```

Reason:

The project requires a city-scale spatial view with real-position sites and 3D visualization.

## Decision C — Backend

```text
Python + FastAPI + Pydantic
```

Reason:

Provides a clean API boundary around the simulation and data model.

## Decision D — Database

```text
PostgreSQL + PostGIS
```

Reason:

Persistent relational + spatial data.

## Decision E — Simulation

```text
Python simulation domain
```

Reason:

The custom cross-site energy simulation is the principal RTIS-owned component.

## Decision F — Integration

```text
HTTP
REST
JSON
GeoJSON
```

Reason:

Simple explicit interfaces between browser, backend and spatial data.

## Decision G — No live telemetry baseline

```text
Synthetic / historical data
+
runtime scenario simulation
```

Reason:

The project brief requires simulation and editable scenarios, not live telemetry infrastructure.

---

# 45. Agent Implementation Rules

Future coding agents should treat this document as the architectural baseline.

Before implementing a feature:

```text
1. Identify the owning region.
2. Identify the existing interface.
3. Reuse the existing stack.
4. Extend the existing model.
5. Add tests.
6. Update the relevant contract.
7. Update documentation if architecture changes.
```

Do not:

```text
Feature request
    ↓
Invent new framework
    ↓
Add new communication path
    ↓
Retrofit existing code
```

Instead:

```text
Existing architecture
       ↓
Existing boundary
       ↓
Existing interface
       ↓
New implementation
```

---

# 46. Final Technical Scope

## Languages

```text
TypeScript
Python
SQL
```

## Frontend

```text
React
CesiumJS
```

## Backend

```text
FastAPI
Pydantic
```

## Database

```text
PostgreSQL
PostGIS
```

## GIS / Data

```text
GeoJSON
GeoPandas
Shapely
PyProj
NumPy
Pandas
```

## Integration

```text
HTTP
REST
JSON
GeoJSON
```

## Infrastructure

```text
Git
GitHub
Docker
Docker Compose
CI/CD
Cloud deployment
```

## Core custom system

```text
Cross-Site Energy Simulation Engine
```

## Core simulation domains

```text
Fleet
Charging
Sites
Capacity
Energy
Cost
Emissions
BESS [optional]
Solar [optional]
```

---

# 47. Final System Shape

The intended final architecture is:

```text
                              USER
                                │
                                ▼
                    ┌─────────────────────┐
                    │       React         │
                    │                     │
                    │ Scenario Controls   │
                    │ Dashboard           │
                    │ Comparison           │
                    │ Time Control         │
                    └──────────┬──────────┘
                               │
                          HTTP / JSON
                               │
                               ▼
                    ┌─────────────────────┐
                    │      FastAPI        │
                    │                     │
                    │ API + Validation    │
                    │ Application Service │
                    └──────────┬──────────┘
                               │
                               ▼
                 ┌────────────────────────────┐
                 │     SIMULATION DOMAIN      │
                 │                            │
                 │ Simulation Engine           │
                 │ ├── Fleet                  │
                 │ ├── Charging               │
                 │ ├── Sites                  │
                 │ ├── Capacity               │
                 │ ├── Energy                 │
                 │ ├── Cost                   │
                 │ ├── Emissions              │
                 │ ├── BESS                   │
                 │ └── Solar                  │
                 └─────────────┬──────────────┘
                               │
                         SimulationResult
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
        ┌───────────────┐             ┌──────────────┐
        │   CesiumJS    │             │   Charts /   │
        │               │             │     KPIs     │
        │ 3D Network    │             │              │
        │ Site State    │             │ Time Series  │
        └───────────────┘             └──────────────┘


              ┌─────────────────────────────────┐
              │       DATA / PERSISTENCE        │
              │                                 │
              │ PostgreSQL + PostGIS             │
              │ Synthetic / Historical Data     │
              │ GIS Processing                   │
              └─────────────────────────────────┘


              ┌─────────────────────────────────┐
              │       INFRASTRUCTURE            │
              │                                 │
              │ Docker / Compose                │
              │ Git / GitHub                    │
              │ CI/CD                           │
              │ Cloud                           │
              └─────────────────────────────────┘
```

---

# 48. Definition of the Baseline

The project foundation is considered architecturally established when:

```text
✓ Frontend exists
✓ Backend exists
✓ Database exists
✓ PostGIS exists
✓ Docker environment exists
✓ CI exists
✓ Frontend ↔ backend connection exists
✓ Backend ↔ database connection exists
✓ API contracts exist
✓ Simulation interface exists
✓ Simulation stub exists
✓ Cesium is initialized
✓ Charting layer exists
✓ Scenario state exists
✓ Time-control interface exists
✓ Baseline synthetic data exists
✓ Baseline scenario exists
✓ Baseline simulation can run
✓ Baseline result can reach the browser
✓ Baseline result can be visualized
✓ Scenario A/B comparison path exists
✓ Extension points exist for BESS / solar / managed charging
```

Only after this point should the team proceed into substantial feature implementation.

---

# 49. Project Philosophy

The technical architecture should embody the brief's central philosophy:

```text
Simple first
     ↓
Make assumptions explicit
     ↓
Build a working simulation
     ↓
Expose scenario controls
     ↓
Visualize consequences
     ↓
Compare decisions
     ↓
Add sophistication without restructuring
```

The goal is not to build the largest possible energy system.

The goal is to build a **coherent, extensible, commercially understandable simulation foundation** where future functionality can be added inside an already-established architecture.
