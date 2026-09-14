# Contracts

These contracts define the stable boundary between transport, application services, simulation, persistence, and frontend presentation. Field names are canonical unless an implementation decision explicitly updates this document.

## Contract conventions

- Transport schemas are versioned independently from internal domain objects.
- Units are explicit: power in `kW`, energy in `kWh`, cost in project currency, emissions in documented mass units, and time in ISO timestamps or documented day offsets.
- A result is immutable after a simulation run.
- Errors are structured and distinguish validation, not-found, dependency, and execution failures.
- Optional BESS and solar fields are represented as disabled/zero values in the baseline rather than pretending those models are active.

## ScenarioRequest

**Owner:** API/application boundary.

**Consumer:** scenario validation service and simulation service.

**Purpose:** Describe user-editable assumptions without exposing simulation internals.

```text
ScenarioRequest
├── scenario_id: string | optional
├── fleet: FleetInput
├── sites: SiteInput[]
├── charging_strategy: ChargingStrategyInput
├── pricing: PricingInput
├── energy_resources: EnergyResourcesInput
├── sustainability: SustainabilityInput
└── simulation_config: SimulationConfigInput
```

Required validation includes percentage bounds, non-negative quantities, valid site references, valid operating windows, positive timestep, and internally consistent allocation splits.

## FleetInput

```text
FleetInput
├── total_vehicles: integer >= 0
├── ev_percentage: number in [0, 100]
├── energy_requirement_kwh: number >= 0 or defined vehicle profile
├── charging_windows: time-window[]
└── depot_assignment: site reference data
```

The exact per-vehicle versus aggregate demand representation is an implementation decision within this contract.

## Site and Charger

```text
Site
├── id: string
├── name: string
├── type: depot | external
├── position: spatial coordinates
├── operating_hours: time window
├── power_limit_kw: number > 0
├── price: pricing reference
└── chargers: Charger[]

Charger
├── id: string
├── site_id: string
├── power_kw: number > 0
└── availability: availability definition
```

## ChargingStrategyInput

Must represent at minimum charging share/allocation and charging window. Managed charging is a future extension and must use this boundary rather than a parallel API.

```text
ChargingStrategyInput
├── depot_share: number in [0, 1]
├── external_share: number in [0, 1]
├── charging_window: time window
└── strategy_type: string | baseline default
```

The applicable shares must satisfy the documented consistency rule, normally summing to 1.

## EnergyResourcesInput

```text
EnergyResourcesInput
├── grid_enabled: boolean
├── bess: DisabledBESSInput | BESSInput
└── solar: DisabledSolarInput | SolarInput
```

Baseline uses grid-only operation with BESS and solar disabled. Detailed battery and photovoltaic physics are out of scope.

## SustainabilityInput

```text
SustainabilityInput
├── electricity_emissions_factor: number >= 0
├── ice_baseline_emissions: documented assumption
├── fuel_displaced: documented assumption
└── reporting_period: string
```

Outputs must be labelled estimates and preserve the assumptions used.

## SimulationConfig

```text
SimulationConfig
├── start_time: timestamp or day offset
├── end_time: timestamp or day offset
├── timestep_minutes: positive integer
└── seed: integer | optional
```

The recommended baseline is one day with a 15-minute timestep, producing 96 intervals. If randomness is absent, seed may be omitted; if randomness is introduced, it becomes part of reproducibility.

## SimulationResult

```text
SimulationResult
├── scenario_id: string
├── timestep_minutes: integer
├── start_time: timestamp/day offset
├── end_time: timestamp/day offset
├── timestamps: timestamp[]
├── sites: SiteResult[]
├── network: NetworkResult
└── sustainability: SustainabilityResult
```

### SiteResult

```text
SiteResult
├── site_id: string
├── load_kw: number[]
├── energy_kwh: number[]
├── utilisation: number[]
├── cost: number[]
├── capacity_limit_kw: number
├── capacity_exceeded: boolean[]
├── grid_import_kw: number[]
├── solar_generation_kw: number[]
└── bess_power_kw: number[]
```

All arrays must align with `timestamps`.

### NetworkResult

```text
NetworkResult
├── total_energy_kwh: number
├── peak_demand_kw: number
├── peak_time: timestamp/day offset
├── total_cost: number
├── total_emissions: number
├── fuel_displaced: number
└── capacity_violation_count: integer
```

### SustainabilityResult

```text
SustainabilityResult
├── electricity_consumption: number
├── emissions: number
├── ice_baseline_emissions: number
└── emissions_reduction: number
```

## ComparisonResult

**Owner:** comparison service.

**Consumer:** comparison API and frontend comparison view.

```text
ComparisonResult
├── scenario_a_id: string
├── scenario_b_id: string
├── metric_differences: named metric values
├── site_differences: site-aligned metric values
├── capacity_differences: violation/utilisation changes
├── sustainability_differences: emissions/fuel changes
└── compatibility: comparison metadata/errors
```

The comparison service consumes completed results and must not rerun simulations.

## API contracts

### `GET /api/health`

Returns service status and dependency readiness. A degraded database status must be distinguishable from an unavailable API.

### `GET /api/sites`

Returns site metadata and spatial positions. It does not return simulation time-series unless explicitly requested by a later contract.

### `GET /api/sites/{site_id}`

Returns one site or a structured not-found error.

### `GET /api/fleet`

Returns the canonical/prepared fleet definition or a structured unavailable-data error.

### `POST /api/scenarios/validate`

Input: `ScenarioRequest`.

Output: validation success with normalized scenario or structured field/domain errors.

### `POST /api/scenarios/simulate`

Input: validated `ScenarioRequest`.

Output: `SimulationResult`.

### `POST /api/scenarios/compare`

Input: two compatible scenario identifiers/results according to the selected persistence policy.

Output: `ComparisonResult`.

### `/api/simulations` endpoints

These endpoints are deferred from the baseline. Baseline simulation results are returned directly from `POST /api/scenarios/simulate` and held in frontend/application memory. No result database, retention policy, or simulation identifier is required yet. If added later, these endpoints must receive an approved persistence contract first.

## Error contract

```text
ErrorResponse
├── code: stable string
├── message: human-readable safe message
├── field_errors: optional field/path details
├── correlation_id: optional
└── details: optional non-secret diagnostic data
```

Errors must not expose secrets or database credentials.

## Contract ownership

- API schemas own serialized request/response shape.
- Simulation domain types own calculation inputs and outputs.
- Shared JSON schemas/examples provide cross-language fixtures where maintained.
- Frontend TypeScript types correspond to approved transport contracts and must not infer undocumented fields.
