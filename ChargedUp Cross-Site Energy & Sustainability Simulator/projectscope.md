# ChargedUp Cross-Site Energy & Sustainability Simulator

## 1. Project Overview

### Project name

GAM300 Project 3: ChargedUp Cross-Site Energy & Sustainability Simulator.

### Purpose

Provide an interactive, browser-based decision-support simulation that shows how fleet charging decisions across depots and external charging sites affect energy demand, cost, infrastructure utilisation, capacity constraints, and emissions.

### Problem being solved

Fleet charging decisions can shift demand between sites and time periods. The project makes those cross-site consequences visible and comparable without requiring live telemetry or utility-grade energy management.

### Intended users

- Project stakeholders evaluating fleet charging scenarios.
- Demonstration users exploring operational and sustainability trade-offs.
- Developers and reviewers validating the simulation architecture.

### High-level system description

The system accepts a validated scenario, runs a deterministic 24-hour simulation over a small network of depots and external charging sites, returns time-series results, and presents those results through a dashboard, charts, comparison views, and an interactive spatial view.

Runtime flow:

```text
Scenario assumptions -> Simulation -> Time-series results -> Visualisation -> Scenario comparison
```

## 2. Objectives

### Primary objectives

- Model a small fleet charging across multiple sites.
- Show time-dependent site demand and utilisation.
- Calculate capacity constraints and violations.
- Estimate energy cost and emissions from explicit assumptions.
- Allow users to edit assumptions and rerun scenarios.
- Support before-and-after comparison of scenarios.
- Provide an interactive spatial and dashboard visualisation.
- Establish a custom cross-site energy simulation component.

### Secondary objectives

- Make assumptions and limitations visible to users.
- Support deterministic demonstrations and regression fixtures.
- Establish extension points for later managed charging, BESS, solar, and richer data.
- Provide a maintainable foundation for future ChargedUp Nexus integration concepts.

## 3. Functional Requirements

### Required capabilities

- Browser-based application.
- Clearly labelled simulated or estimated results.
- Synthetic or approved historical data as the baseline data source.
- User-editable scenario assumptions.
- Fleet representation including vehicle count, EV percentage, energy demand, charging windows, and depot assignment.
- Site representation including depot/external type, position, operating hours, power limit, price, and chargers.
- Charger representation including power, availability, and site ownership.
- Configurable simulation timestep, with 15 minutes as the recommended baseline.
- 24-hour time-series simulation.
- Charging demand and site allocation.
- Site load, utilisation, capacity violations, grid import, cost, and emissions calculations.
- Scenario validation before simulation.
- Scenario A/B comparison independent from the simulation engine.
- Time-slider playback over completed simulation results.
- Dashboard KPIs, charts, alerts, and spatial site-state visualisation.
- Baseline API connectivity from frontend to backend and backend to simulation.
- Baseline database connectivity for persistent prepared data where required.

### Inputs

- Fleet size and EV percentage.
- Vehicle charging energy requirements.
- Charging windows and charging strategy.
- Depot and external-site allocation.
- Site locations, operating hours, power limits, prices, and chargers.
- Electricity emissions factor.
- ICE/diesel baseline assumptions and fuel displaced.
- Optional energy-resource configuration when those features are enabled.
- Simulation timestep and deterministic seed when randomness is used.

### Outputs

- Per-timestep site demand, energy, utilisation, cost, capacity limit, violations, grid import, solar generation, and BESS power where applicable.
- Network totals including energy, peak demand and time, cost, emissions, and fuel displaced.
- Sustainability estimates including electricity consumption, ICE baseline emissions, and emissions reduction.
- Scenario comparison values including changes in energy, peak, cost, utilisation, violations, emissions, and charging share.
- Spatial and dashboard views derived from simulation results.

### Important workflows

1. Load or define the baseline scenario.
2. Edit scenario assumptions.
3. Validate the scenario.
4. Run the 24-hour simulation.
5. Display KPIs, charts, site states, and capacity alerts.
6. Move through completed results with a time slider.
7. Run a second scenario.
8. Compare the two results.

## 4. Non-Functional Requirements

### Performance

- Interactive controls and result playback should feel responsive for the small network and manageable variable count in scope.
- Normal time-slider playback must select existing result indices rather than rerun the backend simulation.
- Baseline simulation execution must be deterministic and suitable for interactive demonstration.

### Reliability

- The same scenario and seed must produce the same result.
- Invalid scenario data must be rejected before reaching the simulation core.
- Baseline startup, API, database, simulation, and visualisation paths must be verifiable.

### Scalability

- The architecture should support additional sites, strategies, energy resources, and datasets within a small-to-moderate project scale.
- It is not required to support utility-scale fleets, continuous telemetry, or production-scale energy management.

### Security

- Secrets must not be committed; environment configuration must use an example file.
- API and database boundaries must remain explicit.
- Authentication, authorisation, and production threat modelling are UNDEFINED for the baseline and must not be invented.

### Usability

- Users must be able to understand the relationship between input, assumption, simulation, result, and business consequence.
- Capacity violations must be immediately visible.
- Sustainability values must show that they are estimates and expose their assumptions.
- Scenario comparison must be understandable without inspecting raw data.

### Maintainability

- Frontend, API/application services, simulation domain, and data/infrastructure remain separate regions.
- The simulation domain must remain executable independently of HTTP and React.
- Frontend API calls must pass through a dedicated client layer.
- Public contracts and major architectural decisions must be documented.

### Platform constraints

- Browser-based application.
- Local development should support Docker Compose with frontend, backend, and PostgreSQL/PostGIS.
- The application is not a Unity or Unreal project.

## 5. System Boundaries

### Inside the project

- React/TypeScript user interface.
- CesiumJS spatial visualisation.
- FastAPI HTTP API and application services.
- Pydantic request and response validation.
- Custom Python simulation domain.
- Fleet, charging, site, capacity, energy, cost, and emissions models.
- Scenario validation and comparison.
- PostgreSQL/PostGIS persistence and repositories where required.
- Synthetic/historical data preparation and GIS processing.
- Baseline Docker, CI, testing, and documentation.

### Outside the project

- Live telemetry ingestion.
- IoT or streaming infrastructure.
- Live CPO, traffic, charging-availability, or utility integrations.
- Utility control or operational energy management.
- Production financial accounting.
- Full carbon or sustainability accounting platforms.
- Detailed electrical-grid, battery-electrochemistry, or photovoltaic-physics simulation.
- Unapproved real-world data acquisition.

## 6. Explicit Non-Goals

The baseline must not implement:

- Live telemetry, sensor ingestion, MQTT, Kafka, or streaming architecture.
- Utility-grade energy management or detailed grid physics.
- Live CPO, traffic, or availability integrations.
- Complex AI optimisation unless separately approved.
- Detailed battery electrochemistry or photovoltaic physics.
- Full financial, carbon, or sustainability accounting.
- Production-scale data or operational control.
- Features that require replacing the approved stack or adding an undocumented communication path.

## 7. MVP / Baseline Scope

The minimum demonstrable system is:

- A React frontend and FastAPI backend.
- PostgreSQL/PostGIS available through the documented local topology.
- A validated canonical synthetic baseline scenario.
- A simulation interface and deterministic stub or minimal engine.
- A 24-hour result contract with time-series data.
- Frontend-to-backend-to-simulation connectivity.
- Baseline sites rendered in CesiumJS.
- Baseline KPIs and chart placeholders.
- A time controller that reads completed results.
- Ability to modify core assumptions, run a second scenario, and compare results once the end-to-end MVP phase is reached.

The architectural baseline is distinct from full functional implementation. BESS, solar, advanced managed charging, and polish are not required for the initial baseline.

## 8. Future Phases

These are FUTURE or OPTIONAL and must not be treated as baseline requirements:

- BESS peak shaving and energy shifting.
- Solar generation profiles.
- Managed or peak-aware charging.
- Richer GIS and historical datasets.
- Sensitivity analysis.
- Scenario presets and advanced explanation.
- Advanced comparison visualisations.
- Commercial presentation polish.
- Deployment hardening and cloud delivery.

## 9. Constraints

### Academic/project constraints

- The project is a GAM300 Project 3 concept for ChargedUp/Upsight.
- The custom cross-site simulation is the principal technical contribution.
- Results are indicative simulations based on explicit assumptions.

### Team constraints

- Team roles, handoff expectations, IP policy, and library/license policy are not specified in the master technical specification.

### Platform constraints

- Browser application.
- TypeScript/React frontend, Python/FastAPI backend, PostgreSQL/PostGIS data layer.
- Docker Compose is the preferred local topology.

### Time constraints

- Development is phased from project definition through foundation, data, simulation MVP, end-to-end MVP, visualisation, comparison, optional sophistication, polish, and validation/handoff.

### Required technologies

- TypeScript, React, CesiumJS.
- Python, FastAPI, Pydantic.
- PostgreSQL, PostGIS.
- GeoJSON, GeoPandas, Shapely, PyProj, NumPy, and Pandas where applicable.
- HTTP, REST, JSON, and GeoJSON integration formats.
- Git, GitHub, Docker, Docker Compose, and CI/CD as infrastructure direction.

## 10. Acceptance Criteria

The project satisfies this scope when:

- A fresh developer can follow documented setup instructions for the baseline.
- Frontend, backend, and database services can start through the approved local topology.
- Frontend-to-backend connectivity works.
- Backend validation rejects invalid scenario data.
- The simulation can run independently of the web server.
- The canonical scenario produces deterministic 24-hour results.
- Results include site and network metrics required by the scope.
- Scenario changes visibly change simulation results where the changed assumption affects the model.
- Results can be scrubbed through time without rerunning the simulation for each timestep.
- Sites and key state are visible in spatial and dashboard views.
- A second scenario can be compared with the baseline once the end-to-end MVP is complete.
- Outputs are labelled as simulations/estimates and expose relevant assumptions.
- No forbidden live-operations functionality or undocumented major dependency is introduced.

## 11. Assumptions

- Baseline data is synthetic unless approved historical data is explicitly supplied.
- The initial simulation represents one day from 00:00 to 24:00.
- A 15-minute timestep is the recommended initial value, but timestep remains configurable.
- Site coordinates and network size are small enough for browser-based spatial visualisation.
- Initial energy modelling can use grid-only operation; BESS and solar are optional later capabilities.
- The database stores prepared and persistent project data but does not perform the energy simulation.
- Exact tariff formulas and allocation algorithms can be defined during architecture and implementation without changing the scope boundary.

## 12. Open Questions

- What target geography and site coordinates should the baseline use?
- Will the project use only synthetic data, or is approved historical data available?
- Which exact baseline numerical values, tariffs, emissions factors, and ICE assumptions are approved?
- What authentication and authorisation, if any, are required beyond local development?
- Which CI provider and cloud deployment target are expected?
- Which dependency versions and browser support matrix are required?
- Are simulation results persisted, or only scenario metadata and source data?
- What library/license approval process applies to CesiumJS and other dependencies?
- What exact allocation and charging-strategy algorithms are required for the MVP?

## SCOPE STATUS:
READY

The remaining open questions refine data, deployment, security, and model details but do not currently prevent the approved baseline architecture from being represented.
