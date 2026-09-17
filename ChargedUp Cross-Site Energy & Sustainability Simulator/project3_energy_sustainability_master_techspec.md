# GAM300 Project 3 â€” Energy & Sustainability Simulator
## Master Project Context, Technical Scope, Repository Baseline & Development Phases

> **Purpose:** This document defines the initial technical baseline for Project 3 so future agents can implement functionality without repeatedly redesigning the architecture or retrofitting integrations.
>
> **Core principle:** establish the application boundaries, technology stack, interfaces, data contracts, build system, deployment structure, and integration points **before feature implementation**. Features should be added inside these boundaries rather than introducing new stacks later.

---

# 1. Project Context

## 1.1 Project

**GAM300 â€” Project 3: Cross-Site Energy & Sustainability Simulator**

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
  â†“
Charging decisions
  â†“
Multiple sites
  â†“
Time-dependent demand
  â†“
Energy / capacity / cost / emissions
  â†“
Visualise consequences
  â†“
Compare scenarios
```

The application should make the consequences of charging timing and allocation visible.

Example:

```text
Scenario A
20 EVs charge around 18:00
        â†“
Depot peak rises
        â†“
Capacity constraint
        â†“
Higher peak exposure / possible violation

Scenario B
Same vehicles
Charging shifted overnight
        â†“
Lower peak
        â†“
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
        â†“
Scenario configuration
        â†“
Runtime simulation
        â†“
24-hour time-series results
        â†“
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
â”œâ”€â”€ id
â”œâ”€â”€ name
â”œâ”€â”€ type
â”‚   â”œâ”€â”€ depot
â”‚   â””â”€â”€ external / CPO
â”œâ”€â”€ geographic position
â”œâ”€â”€ operating hours
â”œâ”€â”€ power limit
â”œâ”€â”€ electricity / charging price
â””â”€â”€ chargers[]
```

Each charger should support at minimum:

```text
Charger
â”œâ”€â”€ id
â”œâ”€â”€ power_kW
â”œâ”€â”€ availability
â””â”€â”€ site_id
```

---

## 5.3 Charging Demand

The model should represent demand over a day.

Baseline time model:

```text
00:00 â†’ 24:00
```

Recommended initial timestep:

```text
15 minutes
```

This creates:

```text
24 hours Ã— 4
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
        â†“
Validate inputs
        â†“
Initialize fleet
        â†“
Initialize sites
        â†“
Initialize chargers
        â†“
Initialize energy resources
        â†“
Generate / assign charging demand
        â†“
Iterate simulation timesteps
        â†“
Calculate site load
        â†“
Calculate capacity utilization
        â†“
Calculate constraint violations
        â†“
Calculate energy cost
        â†“
Apply BESS / solar if enabled
        â†“
Calculate emissions
        â†“
Aggregate network results
        â†“
Produce SimulationResult
```

---

# 7. Time-Series Simulation

The core simulation should produce a result indexed by time.

Conceptually:

```text
Time
 â”‚
 â”œâ”€â”€ 00:00
 â”œâ”€â”€ 00:15
 â”œâ”€â”€ 00:30
 â”œâ”€â”€ ...
 â”œâ”€â”€ 18:00
 â”œâ”€â”€ ...
 â””â”€â”€ 23:45
```

For each site:

```text
SiteState[t]
â”œâ”€â”€ demand_kW
â”œâ”€â”€ energy_kWh
â”œâ”€â”€ utilization
â”œâ”€â”€ cost
â”œâ”€â”€ capacity_limit_kW
â”œâ”€â”€ capacity_exceeded
â”œâ”€â”€ grid_import_kW
â”œâ”€â”€ solar_generation_kW
â””â”€â”€ bess_power_kW
```

The model should preserve enough information to reconstruct the visual state at any time index.

---

# 8. Simulation Result Model

Recommended conceptual contract:

```text
SimulationResult
â”œâ”€â”€ scenario_id
â”œâ”€â”€ timestep
â”œâ”€â”€ start_time
â”œâ”€â”€ end_time
â”œâ”€â”€ timestamps[]
â”œâ”€â”€ sites[]
â”‚   â”œâ”€â”€ site_id
â”‚   â”œâ”€â”€ load_kW[]
â”‚   â”œâ”€â”€ energy_kWh[]
â”‚   â”œâ”€â”€ utilization[]
â”‚   â”œâ”€â”€ cost[]
â”‚   â”œâ”€â”€ capacity_limit_kW
â”‚   â”œâ”€â”€ capacity_exceeded[]
â”‚   â”œâ”€â”€ grid_import_kW[]
â”‚   â”œâ”€â”€ solar_generation_kW[]
â”‚   â””â”€â”€ bess_power_kW[]
â”œâ”€â”€ network
â”‚   â”œâ”€â”€ total_energy_kWh
â”‚   â”œâ”€â”€ peak_demand_kW
â”‚   â”œâ”€â”€ peak_time
â”‚   â”œâ”€â”€ total_cost
â”‚   â”œâ”€â”€ total_emissions
â”‚   â””â”€â”€ fuel_displaced
â””â”€â”€ sustainability
    â”œâ”€â”€ electricity_consumption
    â”œâ”€â”€ emissions
    â”œâ”€â”€ ICE_baseline_emissions
    â””â”€â”€ emissions_reduction
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
        â”‚
        â–¼
site_capacity_kW
        â”‚
        â”œâ”€â”€ load < capacity â†’ normal
        â”‚
        â””â”€â”€ load > capacity â†’ constraint / violation
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
        â†“
Estimate
        â†“
Based on explicit assumptions
```

The UI should show the assumptions behind sustainability results.

---

# 12. Optional Energy Resources

## 12.1 BESS

BESS should be implemented behind an isolated simulation component:

```text
BESSModel
â”œâ”€â”€ capacity_kWh
â”œâ”€â”€ max_charge_kW
â”œâ”€â”€ max_discharge_kW
â”œâ”€â”€ efficiency
â””â”€â”€ state_of_charge
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
â”œâ”€â”€ fleet
â”œâ”€â”€ sites
â”œâ”€â”€ charging_strategy
â”œâ”€â”€ pricing
â”œâ”€â”€ energy_resources
â”œâ”€â”€ sustainability
â””â”€â”€ simulation_config
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
    â†“
SimulationResult A

Scenario B
    â†“
SimulationResult B

        â†“

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
      â†“
Simulation executes 00:00 â†’ 24:00
      â†“
SimulationResult
      â†“
Frontend stores result
      â†“
TIME SLIDER
      â†“
Select result[t]
      â†“
Update:
    â”œâ”€â”€ Cesium site state
    â”œâ”€â”€ charts
    â”œâ”€â”€ KPI cards
    â””â”€â”€ alerts
```

Avoid:

```text
time slider
   â†“
rerun backend simulation
   â†“
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
â”œâ”€â”€ API routing
â”œâ”€â”€ request validation
â”œâ”€â”€ scenario execution
â”œâ”€â”€ result serialization
â””â”€â”€ API errors

Pydantic
â”œâ”€â”€ ScenarioRequest
â”œâ”€â”€ ScenarioResponse
â”œâ”€â”€ SimulationResult
â”œâ”€â”€ Site
â”œâ”€â”€ Charger
â””â”€â”€ API contracts
```

The simulation engine should remain separate from FastAPI.

Preferred dependency direction:

```text
FastAPI
   â†“
Application / Services
   â†“
Simulation Domain
```

not:

```text
Simulation
   â†“
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
  â”‚
  â”‚ HTTP / JSON
  â–¼
FastAPI
  â”‚
  â–¼
Application Service
  â”‚
  â–¼
Simulation Engine
  â”‚
  â”œâ”€â”€ Domain Models
  â”œâ”€â”€ Charging Model
  â”œâ”€â”€ Site Model
  â”œâ”€â”€ Cost Model
  â”œâ”€â”€ Capacity Model
  â”œâ”€â”€ BESS Model
  â””â”€â”€ Emissions Model
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
â”œâ”€â”€ client.ts
â”œâ”€â”€ healthApi.ts
â”œâ”€â”€ sitesApi.ts
â”œâ”€â”€ scenariosApi.ts
â”œâ”€â”€ simulationsApi.ts
â””â”€â”€ comparisonApi.ts
```

All backend communication passes through this layer.

---

# 24. Shared Contracts

Where practical, maintain a clear correspondence between backend Pydantic models and frontend TypeScript types.

```text
Backend
Pydantic
    â”‚
    â”‚ JSON
    â–¼
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
â”‚
â”œâ”€â”€ README.md
â”œâ”€â”€ LICENSE
â”œâ”€â”€ .gitignore
â”œâ”€â”€ .env.example
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ Makefile
â”‚
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ project-context.md
â”‚   â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--architecture.md
â”‚   â”œâ”€â”€ simulation-model.md
â”‚   â”œâ”€â”€ api-contract.md
â”‚   â”œâ”€â”€ data-model.md
â”‚   â”œâ”€â”€ gis-data.md
â”‚   â”œâ”€â”€ deployment.md
â”‚   â””â”€â”€ decisions/
â”‚       â”œâ”€â”€ ADR-001-stack.md
â”‚       â”œâ”€â”€ ADR-002-simulation-boundary.md
â”‚       â”œâ”€â”€ ADR-003-api-boundary.md
â”‚       â””â”€â”€ ADR-004-time-series-model.md
â”‚
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ tsconfig.json
â”‚   â”œâ”€â”€ vite.config.ts
â”‚   â”œâ”€â”€ public/
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ main.tsx
â”‚       â”œâ”€â”€ App.tsx
â”‚       â”‚
â”‚       â”œâ”€â”€ api/
â”‚       â”‚   â”œâ”€â”€ client.ts
â”‚       â”‚   â”œâ”€â”€ healthApi.ts
â”‚       â”‚   â”œâ”€â”€ sitesApi.ts
â”‚       â”‚   â”œâ”€â”€ scenariosApi.ts
â”‚       â”‚   â”œâ”€â”€ simulationsApi.ts
â”‚       â”‚   â””â”€â”€ comparisonApi.ts
â”‚       â”‚
â”‚       â”œâ”€â”€ types/
â”‚       â”‚   â”œâ”€â”€ scenario.ts
â”‚       â”‚   â”œâ”€â”€ simulation.ts
â”‚       â”‚   â”œâ”€â”€ site.ts
â”‚       â”‚   â”œâ”€â”€ charger.ts
â”‚       â”‚   â””â”€â”€ comparison.ts
â”‚       â”‚
â”‚       â”œâ”€â”€ state/
â”‚       â”‚   â”œâ”€â”€ scenarioStore.ts
â”‚       â”‚   â”œâ”€â”€ simulationStore.ts
â”‚       â”‚   â””â”€â”€ viewStore.ts
â”‚       â”‚
â”‚       â”œâ”€â”€ components/
â”‚       â”‚   â”œâ”€â”€ scenario/
â”‚       â”‚   â”‚   â”œâ”€â”€ FleetControls.tsx
â”‚       â”‚   â”‚   â”œâ”€â”€ ChargingControls.tsx
â”‚       â”‚   â”‚   â”œâ”€â”€ SiteControls.tsx
â”‚       â”‚   â”‚   â”œâ”€â”€ EnergyControls.tsx
â”‚       â”‚   â”‚   â””â”€â”€ SustainabilityControls.tsx
â”‚       â”‚   â”‚
â”‚       â”‚   â”œâ”€â”€ dashboard/
â”‚       â”‚   â”‚   â”œâ”€â”€ KPIGrid.tsx
â”‚       â”‚   â”‚   â”œâ”€â”€ CostPanel.tsx
â”‚       â”‚   â”‚   â”œâ”€â”€ CapacityPanel.tsx
â”‚       â”‚   â”‚   â””â”€â”€ EmissionsPanel.tsx
â”‚       â”‚   â”‚
â”‚       â”‚   â”œâ”€â”€ timeline/
â”‚       â”‚   â”‚   â”œâ”€â”€ TimeSlider.tsx
â”‚       â”‚   â”‚   â””â”€â”€ TimelineControls.tsx
â”‚       â”‚   â”‚
â”‚       â”‚   â”œâ”€â”€ comparison/
â”‚       â”‚   â”‚   â”œâ”€â”€ ScenarioComparison.tsx
â”‚       â”‚   â”‚   â””â”€â”€ ComparisonCharts.tsx
â”‚       â”‚   â”‚
â”‚       â”‚   â””â”€â”€ common/
â”‚       â”‚
â”‚       â”œâ”€â”€ cesium/
â”‚       â”‚   â”œâ”€â”€ CesiumViewer.ts
â”‚       â”‚   â”œâ”€â”€ SiteLayer.ts
â”‚       â”‚   â”œâ”€â”€ NetworkLayer.ts
â”‚       â”‚   â”œâ”€â”€ SiteStateRenderer.ts
â”‚       â”‚   â””â”€â”€ CesiumTimeController.ts
â”‚       â”‚
â”‚       â”œâ”€â”€ charts/
â”‚       â”‚   â”œâ”€â”€ LoadChart.tsx
â”‚       â”‚   â”œâ”€â”€ CostChart.tsx
â”‚       â”‚   â”œâ”€â”€ UtilizationChart.tsx
â”‚       â”‚   â””â”€â”€ EmissionsChart.tsx
â”‚       â”‚
â”‚       â””â”€â”€ utils/
â”‚
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ pyproject.toml
â”‚   â”œâ”€â”€ requirements.txt
â”‚   â””â”€â”€ app/
â”‚       â”œâ”€â”€ main.py
â”‚       â”‚
â”‚       â”œâ”€â”€ api/
â”‚       â”‚   â”œâ”€â”€ health.py
â”‚       â”‚   â”œâ”€â”€ sites.py
â”‚       â”‚   â”œâ”€â”€ scenarios.py
â”‚       â”‚   â”œâ”€â”€ simulations.py
â”‚       â”‚   â””â”€â”€ comparisons.py
â”‚       â”‚
â”‚       â”œâ”€â”€ schemas/
â”‚       â”‚   â”œâ”€â”€ scenario.py
â”‚       â”‚   â”œâ”€â”€ simulation.py
â”‚       â”‚   â”œâ”€â”€ site.py
â”‚       â”‚   â”œâ”€â”€ charger.py
â”‚       â”‚   â””â”€â”€ comparison.py
â”‚       â”‚
â”‚       â”œâ”€â”€ services/
â”‚       â”‚   â”œâ”€â”€ scenario_service.py
â”‚       â”‚   â”œâ”€â”€ simulation_service.py
â”‚       â”‚   â””â”€â”€ comparison_service.py
â”‚       â”‚
â”‚       â”œâ”€â”€ simulation/
â”‚       â”‚   â”œâ”€â”€ engine.py
â”‚       â”‚   â”œâ”€â”€ clock.py
â”‚       â”‚   â”œâ”€â”€ state.py
â”‚       â”‚   â”‚
â”‚       â”‚   â”œâ”€â”€ fleet/
â”‚       â”‚   â”‚   â”œâ”€â”€ fleet_model.py
â”‚       â”‚   â”‚   â””â”€â”€ charging_demand.py
â”‚       â”‚   â”‚
â”‚       â”‚   â”œâ”€â”€ sites/
â”‚       â”‚   â”‚   â”œâ”€â”€ site_model.py
â”‚       â”‚   â”‚   â”œâ”€â”€ capacity.py
â”‚       â”‚   â”‚   â””â”€â”€ charger_model.py
â”‚       â”‚   â”‚
â”‚       â”‚   â”œâ”€â”€ energy/
â”‚       â”‚   â”‚   â”œâ”€â”€ energy_model.py
â”‚       â”‚   â”‚   â”œâ”€â”€ bess.py
â”‚       â”‚   â”‚   â””â”€â”€ solar.py
â”‚       â”‚   â”‚
â”‚       â”‚   â”œâ”€â”€ economics/
â”‚       â”‚   â”‚   â””â”€â”€ cost_model.py
â”‚       â”‚   â”‚
â”‚       â”‚   â””â”€â”€ sustainability/
â”‚       â”‚       â””â”€â”€ emissions.py
â”‚       â”‚
â”‚       â”œâ”€â”€ data/
â”‚       â”‚   â”œâ”€â”€ repositories/
â”‚       â”‚   â”‚   â”œâ”€â”€ site_repository.py
â”‚       â”‚   â”‚   â””â”€â”€ fleet_repository.py
â”‚       â”‚   â””â”€â”€ seed/
â”‚       â”‚
â”‚       â”œâ”€â”€ db/
â”‚       â”‚   â”œâ”€â”€ connection.py
â”‚       â”‚   â”œâ”€â”€ models.py
â”‚       â”‚   â””â”€â”€ migrations/
â”‚       â”‚
â”‚       â””â”€â”€ config/
â”‚           â””â”€â”€ settings.py
â”‚
â”œâ”€â”€ shared/
â”‚   â”œâ”€â”€ schemas/
â”‚   â”‚   â”œâ”€â”€ scenario.schema.json
â”‚   â”‚   â”œâ”€â”€ simulation-result.schema.json
â”‚   â”‚   â””â”€â”€ site.schema.json
â”‚   â””â”€â”€ examples/
â”‚       â”œâ”€â”€ baseline-scenario.json
â”‚       â””â”€â”€ baseline-result.json
â”‚
â”œâ”€â”€ data/
â”‚   â”œâ”€â”€ raw/
â”‚   â”œâ”€â”€ processed/
â”‚   â”œâ”€â”€ synthetic/
â”‚   â””â”€â”€ README.md
â”‚
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ seed_database.py
â”‚   â”œâ”€â”€ generate_synthetic_data.py
â”‚   â”œâ”€â”€ validate_gis_data.py
â”‚   â””â”€â”€ run_simulation.py
â”‚
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ backend/
â”‚   â”‚   â”œâ”€â”€ simulation/
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â””â”€â”€ data/
â”‚   â”œâ”€â”€ frontend/
â”‚   â””â”€â”€ integration/
â”‚
â”œâ”€â”€ infra/
â”‚   â”œâ”€â”€ docker/
â”‚   â”‚   â”œâ”€â”€ frontend.Dockerfile
â”‚   â”‚   â””â”€â”€ backend.Dockerfile
â”‚   â”œâ”€â”€ nginx/
â”‚   â””â”€â”€ cloud/
â”‚
â””â”€â”€ .github/
    â””â”€â”€ workflows/
        â”œâ”€â”€ ci.yml
        â””â”€â”€ build.yml
```

---

# 26. Architectural Regions

The repository should be treated as four major regions.

## REGION A â€” Frontend

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

## REGION B â€” Backend / Application

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

## REGION C â€” Simulation Domain

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

## REGION D â€” Data / Infrastructure

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
                       â”‚
                    HTTP/JSON
                       â”‚
                       â–¼
                     API
                       â”‚
                       â–¼
                 APPLICATION
                   SERVICES
                       â”‚
                       â–¼
                 SIMULATION
                    DOMAIN
                       â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”
              â–¼                 â–¼
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
    â”‚
    â”œâ”€â”€ API client
    â”‚
    â–¼
[FastAPI]
    â”‚
    â”œâ”€â”€ Pydantic contracts
    â”‚
    â–¼
[Application Service]
    â”‚
    â–¼
[Simulation Engine]
    â”‚
    â”œâ”€â”€ Domain models
    â”œâ”€â”€ Cost model
    â”œâ”€â”€ Capacity model
    â”œâ”€â”€ Emissions model
    â”œâ”€â”€ BESS interface
    â””â”€â”€ Solar interface
    â”‚
    â–¼
[Result Contract]
    â”‚
    â–¼
[Frontend]
    â”‚
    â”œâ”€â”€ Dashboard
    â”œâ”€â”€ Charts
    â””â”€â”€ Cesium
```

Database:

```text
FastAPI / Services
        â”‚
        â–¼
Repository interface
        â”‚
        â–¼
PostgreSQL/PostGIS
```

GIS:

```text
GIS source
    â†“
GeoPandas / Shapely / PyProj
    â†“
Processed GeoJSON / spatial records
    â†“
PostGIS
    â†“
FastAPI
    â†“
CesiumJS
```

---

# 29. Baseline Project Requirement

Before implementing feature work, the repository should be capable of:

```text
1. Start frontend
2. Start backend
3. Start PostgreSQL/PostGIS
4. Establish frontend â†’ backend connectivity
5. Establish backend â†’ database connectivity
6. Establish backend â†’ simulation connectivity
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
 â†“
React
 â†“
POST /api/scenarios/simulate
 â†“
Pydantic validation
 â†“
SimulationService
 â†“
SimulationEngine
 â†“
24-hour simulation
 â†“
SimulationResult
 â†“
JSON
 â†“
React
 â†“
Cesium + charts + KPIs
```

This should exist before advanced simulation behaviour.

---

# 32. Development Phases

# Phase 0 â€” Project Definition

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

# Phase 1 â€” Foundation & Integration

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
- Frontend â†” backend API client.
- Backend â†” database connection.
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
  â†“
React
  â†“
FastAPI
  â†“
Simulation stub
  â†“
JSON result
  â†“
Cesium
```

and:

```text
FastAPI
  â†“
PostgreSQL/PostGIS
```

must already work.

No later feature should need to introduce a fundamental communication path.

---

# Phase 2 â€” Data Foundation

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
 â†“
GeoPandas
 â†“
Shapely / PyProj
 â†“
Processed data
 â†“
PostGIS / GeoJSON
```

### Deliverable

A complete baseline dataset that the simulation can consume.

---

# Phase 3 â€” Core Simulation MVP

Implement only the essential simulation:

```text
Fleet
 â†“
Charging demand
 â†“
Site allocation
 â†“
Site load
 â†“
Capacity
 â†“
Cost
 â†“
Emissions
 â†“
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

# Phase 4 â€” End-to-End MVP

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

# Phase 5 â€” Visualization & Explanation

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

# Phase 6 â€” Scenario Comparison

Formalize:

```text
Scenario A
Scenario B
     â†“
Comparison Engine
     â†“
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

# Phase 7 â€” Progressive Sophistication

Only after the MVP is stable:

### Optional BESS

```text
BESS
 â†“
Peak shaving
 â†“
Capacity effect
 â†“
Cost effect
```

### Optional Solar

```text
Solar
 â†“
Generation profile
 â†“
Reduced grid import
 â†“
Cost / emissions effect
```

### Optional managed charging

```text
Unmanaged
      â†“
Peak-aware scheduling
      â†“
Managed scenario
```

These should plug into existing simulation interfaces rather than restructure the system.

---

# Phase 8 â€” Polish & Commercial Presentation

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
 â†“
Assumption
 â†“
Simulation
 â†“
Result
 â†“
Business consequence
```

---

# Phase 9 â€” Validation & Handoff

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

## Tier 0 â€” Architecture

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

## Tier 1 â€” MVP

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

## Tier 2 â€” Strong Product

```text
Better visual encoding
Managed charging
Scenario presets
Improved explanation
Advanced comparisons
```

## Tier 3 â€” Stretch

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

## Rule 1 â€” Extend existing boundaries

If adding BESS:

```text
simulation/energy/bess.py
```

not a new backend subsystem.

## Rule 2 â€” Preserve API contracts

New functionality should extend existing schemas rather than create parallel APIs.

## Rule 3 â€” Preserve simulation independence

Simulation code must remain runnable without FastAPI.

## Rule 4 â€” Preserve visualization independence

Cesium should consume simulation results rather than implement simulation rules.

## Rule 5 â€” No feature-driven stack additions

Do not introduce a new framework/library simply because a feature is being implemented.

First determine whether the existing architecture already supports the feature.

## Rule 6 â€” Integration before functionality

If a future feature requires a new subsystem, its interface must be established first, even if the initial implementation is a stub.

Example:

```text
BESS interface
    â†“
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
â”œâ”€â”€ GridResource
â”œâ”€â”€ BESSResource
â””â”€â”€ SolarResource
```

```text
ChargingStrategy
â”œâ”€â”€ UnmanagedCharging
â””â”€â”€ ManagedCharging
```

```text
CostModel
â”œâ”€â”€ FlatRateCost
â””â”€â”€ TimeOfUseCost
```

```text
EmissionsModel
â””â”€â”€ GridAndICEBaselineModel
```

```text
DataProvider
â”œâ”€â”€ SyntheticDataProvider
â””â”€â”€ HistoricalDataProvider
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
   â†“
API
   â†“
Simulation
   â†“
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
    â†“
Simulation
    â†“
Result A

Scenario A
    â†“
Simulation
    â†“
Result A
```

If randomness is introduced later:

```text
Scenario
+
Seed
 â†“
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
        â†“
API validation
        â†“
Domain validation
        â†“
Simulation
        â†“
Result
```

Invalid examples:

- EV percentage outside 0â€“100%.
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
   â”‚
   â–¼
Frontend container / dev server
   â”‚
   â–¼
Backend container / dev server
   â”‚
   â–¼
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
 â†“
Install dependencies
 â†“
Frontend build
 â†“
Backend tests
 â†“
Simulation tests
 â†“
Integration checks
```

Later:

```text
 â†“
Docker build
 â†“
Deployment artifact
```

---

# 43. Documentation Structure

Maintain:

```text
docs/
â”œâ”€â”€ project-context.md
â”œâ”€â”€ UNDATED--FOUNDATION--UNDATED--FOUNDATION--architecture.md
â”œâ”€â”€ simulation-model.md
â”œâ”€â”€ api-contract.md
â”œâ”€â”€ data-model.md
â”œâ”€â”€ gis-data.md
â”œâ”€â”€ deployment.md
â””â”€â”€ decisions/
```

Every major architectural decision should have a short ADR.

---

# 44. Architecture Decision Summary

## Decision A â€” Browser application

```text
React + TypeScript
```

Reason:

The project is explicitly a browser-based application.

## Decision B â€” 3D/GIS

```text
CesiumJS
```

Reason:

The project requires a city-scale spatial view with real-position sites and 3D visualization.

## Decision C â€” Backend

```text
Python + FastAPI + Pydantic
```

Reason:

Provides a clean API boundary around the simulation and data model.

## Decision D â€” Database

```text
PostgreSQL + PostGIS
```

Reason:

Persistent relational + spatial data.

## Decision E â€” Simulation

```text
Python simulation domain
```

Reason:

The custom cross-site energy simulation is the principal RTIS-owned component.

## Decision F â€” Integration

```text
HTTP
REST
JSON
GeoJSON
```

Reason:

Simple explicit interfaces between browser, backend and spatial data.

## Decision G â€” No live telemetry baseline

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
    â†“
Invent new framework
    â†“
Add new communication path
    â†“
Retrofit existing code
```

Instead:

```text
Existing architecture
       â†“
Existing boundary
       â†“
Existing interface
       â†“
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
                                â”‚
                                â–¼
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚       React         â”‚
                    â”‚                     â”‚
                    â”‚ Scenario Controls   â”‚
                    â”‚ Dashboard           â”‚
                    â”‚ Comparison           â”‚
                    â”‚ Time Control         â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
                          HTTP / JSON
                               â”‚
                               â–¼
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚      FastAPI        â”‚
                    â”‚                     â”‚
                    â”‚ API + Validation    â”‚
                    â”‚ Application Service â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
                               â–¼
                 â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                 â”‚     SIMULATION DOMAIN      â”‚
                 â”‚                            â”‚
                 â”‚ Simulation Engine           â”‚
                 â”‚ â”œâ”€â”€ Fleet                  â”‚
                 â”‚ â”œâ”€â”€ Charging               â”‚
                 â”‚ â”œâ”€â”€ Sites                  â”‚
                 â”‚ â”œâ”€â”€ Capacity               â”‚
                 â”‚ â”œâ”€â”€ Energy                 â”‚
                 â”‚ â”œâ”€â”€ Cost                   â”‚
                 â”‚ â”œâ”€â”€ Emissions              â”‚
                 â”‚ â”œâ”€â”€ BESS                   â”‚
                 â”‚ â””â”€â”€ Solar                  â”‚
                 â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
                         SimulationResult
                               â”‚
                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚                             â”‚
                â–¼                             â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”             â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚   CesiumJS    â”‚             â”‚   Charts /   â”‚
        â”‚               â”‚             â”‚     KPIs     â”‚
        â”‚ 3D Network    â”‚             â”‚              â”‚
        â”‚ Site State    â”‚             â”‚ Time Series  â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜


              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚       DATA / PERSISTENCE        â”‚
              â”‚                                 â”‚
              â”‚ PostgreSQL + PostGIS             â”‚
              â”‚ Synthetic / Historical Data     â”‚
              â”‚ GIS Processing                   â”‚
              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜


              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚       INFRASTRUCTURE            â”‚
              â”‚                                 â”‚
              â”‚ Docker / Compose                â”‚
              â”‚ Git / GitHub                    â”‚
              â”‚ CI/CD                           â”‚
              â”‚ Cloud                           â”‚
              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

# 48. Definition of the Baseline

The project foundation is considered architecturally established when:

```text
âœ“ Frontend exists
âœ“ Backend exists
âœ“ Database exists
âœ“ PostGIS exists
âœ“ Docker environment exists
âœ“ CI exists
âœ“ Frontend â†” backend connection exists
âœ“ Backend â†” database connection exists
âœ“ API contracts exist
âœ“ Simulation interface exists
âœ“ Simulation stub exists
âœ“ Cesium is initialized
âœ“ Charting layer exists
âœ“ Scenario state exists
âœ“ Time-control interface exists
âœ“ Baseline synthetic data exists
âœ“ Baseline scenario exists
âœ“ Baseline simulation can run
âœ“ Baseline result can reach the browser
âœ“ Baseline result can be visualized
âœ“ Scenario A/B comparison path exists
âœ“ Extension points exist for BESS / solar / managed charging
```

Only after this point should the team proceed into substantial feature implementation.

---

# 49. Project Philosophy

The technical architecture should embody the brief's central philosophy:

```text
Simple first
     â†“
Make assumptions explicit
     â†“
Build a working simulation
     â†“
Expose scenario controls
     â†“
Visualize consequences
     â†“
Compare decisions
     â†“
Add sophistication without restructuring
```

The goal is not to build the largest possible energy system.

The goal is to build a **coherent, extensible, commercially understandable simulation foundation** where future functionality can be added inside an already-established architecture.
