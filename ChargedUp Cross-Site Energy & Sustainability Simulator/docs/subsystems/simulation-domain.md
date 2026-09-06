# Simulation Domain Subsystem

## Purpose

Execute a deterministic 24-hour cross-site charging simulation from validated domain inputs and return aligned time-series and aggregate results.

## Responsibilities

- Validate simulation-specific invariants.
- Generate or assign charging demand.
- Apply charging strategy to fleet/site allocation.
- Calculate site loads, energy, utilisation, capacity violations, grid import, costs, and emissions.
- Provide isolated extension points for BESS, solar, and managed charging.
- Aggregate site results into network and sustainability results.

## Non-responsibilities

- HTTP routing, JSON serialisation, database access, React, CesiumJS, charts, authentication, live telemetry, or production accounting.

## Proposed modules

```text
backend/app/simulation/
├── engine.py
├── clock.py
├── state.py
├── fleet/
│   ├── fleet_model.py
│   └── charging_demand.py
├── sites/
│   ├── site_model.py
│   ├── charger_model.py
│   └── capacity.py
├── energy/
│   ├── energy_model.py
│   ├── bess.py
│   └── solar.py
├── economics/
│   └── cost_model.py
└── sustainability/
    └── emissions.py
```

## Core interfaces

### `SimulationEngine`

- `validate(scenario: Scenario) -> ValidationResult`
- `run(scenario: Scenario, config: SimulationConfig) -> SimulationResult`

Owns the orchestration of one isolated simulation run. It does not own transport or persistence.

### `SimulationClock`

- `timestamps(config: SimulationConfig) -> list[TimePoint]`
- `interval_count(config: SimulationConfig) -> int`

Defines interval boundaries and ensures result arrays align with timestamps.

### `ChargingDemandModel`

- `generate(fleet: Fleet, strategy: ChargingStrategy, clock: SimulationClock) -> DemandProfile`

Creates deterministic demand from fleet assumptions and charging windows.

### `CapacityModel`

- `evaluate(load_kw: float, capacity_kw: float) -> CapacityState`

Calculates utilisation and capacity-exceeded state.

### `CostModel`

- `calculate(site: Site, energy_kwh: float, time: TimePoint) -> CostValue`

Applies the approved simple tariff assumptions. It must not fetch live prices.

### `EmissionsModel`

- `calculate(grid_energy_kwh: float, assumptions: SustainabilityAssumptions) -> EmissionsValue`

Produces indicative emissions and baseline comparison values from explicit assumptions.

### `EnergyResource`

- `apply(site_state: SiteState, context: EnergyContext) -> EnergyAdjustment`

Baseline implementation is grid-only. BESS and solar remain isolated future implementations.

### `ComparisonService`

- `compare(first: SimulationResult, second: SimulationResult) -> ComparisonResult`

Lives outside the simulation engine and never reruns scenarios.

## Data flow

```text
Scenario + SimulationConfig
    -> domain validation
    -> clock creates timestamps
    -> demand model creates demand profile
    -> engine iterates intervals
       -> allocate charging
       -> apply energy resources
       -> evaluate capacity
       -> calculate cost/emissions
       -> append site state
    -> aggregate network/sustainability values
    -> SimulationResult
```

## State and ownership

- Engine owns mutable state only for the active run.
- Site state is internal until converted into result records.
- Result arrays are immutable after completion.
- No global mutable simulation state.
- No database entities inside the calculation loop.

## Threading model

Baseline execution is synchronous and single-run. Parallel execution, background jobs, and streaming are out of scope. Any later concurrency change requires a performance and lifecycle decision.

## Error handling

Reject before iteration when inputs include invalid percentages, negative power, invalid capacities, invalid windows, unknown site references, inconsistent allocation, or invalid timestep. During execution, return a typed failure rather than a partial successful result unless partial results are added to the contract.

## Testing requirements

- Clock interval count and boundaries.
- Demand distribution and charging-window behavior.
- Capacity boundary equal/under/over cases.
- Cost and emissions units.
- Deterministic repeated runs.
- Result array alignment.
- Baseline golden fixture.
- Independent execution without FastAPI or database.

## Future extension points

- `EnergyResource`: grid, BESS, solar.
- `ChargingStrategy`: unmanaged, managed.
- `CostModel`: flat-rate, time-of-use.
- `DataProvider`: synthetic, historical.

Future implementations must preserve the engine contract and grid-only baseline behavior.
