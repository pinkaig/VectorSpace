# Implementation Plan

Each phase must leave the repository buildable and must stay within its documented boundary. A phase agent must read the relevant contracts and subsystem document before editing.

## Phase 0 — Project Definition

**Purpose:** Resolve planning prerequisites and freeze the baseline direction.

**Prerequisites:** Approved scope, technology stack, and this pre-baseline package.

**Dependencies:** Team decisions on versions, package manager, test tools, license policy, target geography, synthetic data, and handoff expectations.

**Allowed changes:** Planning documents, ADRs, README, initial issue/backlog records.

**Outputs:** Approved planning package, decision records, canonical vocabulary, unresolved-decision list.

**Acceptance:** Cross-document consistency pass succeeds; no critical technology or architectural conflict remains.

**Verification:** Manual document review and consistency checklist.

## Phase 1 — Repository and Build Infrastructure

**Purpose:** Establish a fresh-buildable repository and local topology.

**Prerequisites:** Phase 0 and resolved minimum toolchain versions.

**Dependencies:** Node/Python package managers, Docker, PostgreSQL/PostGIS.

**Allowed changes:** root build/config files, frontend/backend skeleton entry points, Docker/Compose, CI, environment examples, test harness.

**Outputs:** frontend project, backend project, database service, build/test commands, health endpoint, empty test suites.

**Acceptance:** clean install/configure/build/test/start path is documented and works.

**Verification:** clean checkout procedure, frontend build, backend startup/import, database readiness, CI run.

## Phase 2 — Contracts and Integration Skeleton

**Purpose:** Prove communication paths before feature logic.

**Prerequisites:** Phase 1.

**Dependencies:** API contract, shared examples, frontend API client, FastAPI, Pydantic, database connectivity.

**Allowed changes:** `shared/`, API schemas/routes, application service interfaces, repository interfaces, frontend API/types/state placeholders, Cesium/chart/time-controller placeholders.

**Outputs:** health/sites/fleet/scenario validation/simulation placeholder boundaries, deterministic result fixture, frontend-to-backend request path.

**Acceptance:** a validated baseline request reaches a simulation stub and returns a result that frontend consumers can load.

**Verification:** API integration test, deterministic fixture comparison, frontend API/client smoke check.

## Phase 3 — Data Foundation

**Purpose:** Provide the canonical synthetic data required by the simulation.

**Prerequisites:** Phases 1-2.

**Dependencies:** chosen database access/migration tooling and GIS processing libraries.

**Allowed changes:** `data/`, repository implementations, database migrations/models, seed scripts, GIS preparation scripts, site/fleet contracts if approved.

**Outputs:** sites, chargers, fleet, prices, power limits, coordinates, and emissions assumptions.

**Acceptance:** prepared data loads through repositories and satisfies contract validation.

**Verification:** seed/migration test, repository integration tests, geometry/CRS validation.

## Phase 4 — Core Simulation MVP

**Purpose:** Implement the essential deterministic cross-site model.

**Prerequisites:** contracts, canonical data, integration skeleton.

**Dependencies:** clock, fleet demand, site/charger, capacity, cost, emissions, and result contracts.

**Allowed changes:** `backend/app/simulation/` and simulation tests/fixtures.

**Outputs:** 24-hour simulation with demand, site allocation, load, capacity, cost, emissions, and result aggregation.

**Acceptance:** same scenario/seed produces the same result; result arrays align; invalid domain inputs fail clearly.

**Verification:** unit tests, golden baseline regression, independent simulation invocation.

## Phase 5 — End-to-End MVP

**Purpose:** Connect actual simulation behavior to user workflows.

**Prerequisites:** Phase 4.

**Dependencies:** frontend controls/state, API endpoint, result consumers, baseline data.

**Allowed changes:** relevant frontend components/API modules, API/application service implementation, integration tests.

**Outputs:** edit EV percentage, charging timing, and site allocation; run simulation; display KPIs, charts, site state, alerts, and time playback.

**Acceptance:** changed inputs produce visibly changed results; time slider reads completed results without rerunning each timestep.

**Verification:** end-to-end API test and browser/manual workflow test.

## Phase 6 — Visualization and Explanation

**Purpose:** Make consequences legible without raw-data inspection.

**Prerequisites:** Phase 5.

**Dependencies:** stable result contracts and Cesium/chart boundaries.

**Allowed changes:** frontend visual components, Cesium layers, charts, assumption/alert presentation.

**Outputs:** clear load/utilisation/capacity encodings, timeline, network overview, costs, energy, emissions, and labels.

**Acceptance:** capacity violations and assumptions are immediately understandable.

**Verification:** focused frontend tests, browser smoke checks, responsive visual review.

## Phase 7 — Scenario Comparison

**Purpose:** Formalize Scenario A/B differences.

**Prerequisites:** stable simulation result contract and Phase 5 workflow.

**Dependencies:** comparison service and compatible result alignment.

**Allowed changes:** comparison service/API/frontend comparison components/tests.

**Outputs:** KPI, peak, cost, utilisation, capacity, emissions, and before/after comparisons.

**Acceptance:** comparison is independent of simulation execution and clearly identifies scenario identities and metric direction.

**Verification:** comparison unit/API/UI tests with deterministic fixtures.

## Phase 8 — Optional Progressive Sophistication

**Purpose:** Add approved extensions without restructuring the core.

**Prerequisites:** MVP stability and explicit approval for each feature.

**Dependencies:** existing energy-resource and charging-strategy interfaces.

**Allowed changes:** bounded simulation extension modules and related contracts/tests/docs.

**Outputs:** optional BESS, solar, and managed charging implementations.

**Acceptance:** existing grid-only baseline remains valid; each extension has isolated tests and visible assumptions.

**Verification:** regression suite plus feature-specific simulation tests.

## Phase 9 — Polish and Handoff

**Purpose:** Improve usability, reliability, documentation, and reproducibility.

**Prerequisites:** MVP and selected optional features are stable.

**Dependencies:** validation plan, deployment decisions, known limitations.

**Allowed changes:** UX polish, loading/error/empty states, docs, setup/deployment, CI hardening, demo presets.

**Outputs:** handoff package, known limitations, extension points, documented setup and deployment.

**Acceptance:** new developer can build, run, test, understand assumptions, and identify deferred work.

**Verification:** clean environment validation, full test suite, handoff review.

## Phase gate rule

A phase cannot silently absorb another phase's work. If a prerequisite contract or architecture is insufficient, stop and report the missing decision or architectural conflict before implementation.
