# Pre-Baseline Validation

## Status

READY

The baseline toolchain and local runtime decisions are resolved. Production deployment, authentication, browser automation, and persistent simulation-result storage remain explicit deferred placeholders and do not block local baseline generation.

## Scope

PASS

The project scope defines the required simulation, MVP boundary, explicit non-goals, assumptions, acceptance criteria, and future work. No required capability currently lacks an architectural home.

## Technology

PASS

The primary stack and baseline runtime choices are fixed: Node.js 22/npm, Python 3.12/pip, React 19, TypeScript 5.7, Vite 6, CesiumJS 1.125, FastAPI 0.115, Pydantic 2.10, PostgreSQL 16, PostGIS 3.4, SQLAlchemy 2, Alembic, pytest, Vitest, Recharts, and GitHub Actions. Exact patch versions will be locked in the generated repository.

## Architecture

PASS

Frontend, API/application, simulation domain, data/GIS, and infrastructure responsibilities are separated. The simulation remains independent of transport, persistence, and rendering.

## Repository

PASS

The proposed hierarchy represents all major regions and distinguishes fixed, extensible, generated, and optional areas.

## Integrations

PASS

Frontend/API, application/simulation, application/database, GIS preparation, and result/visualisation boundaries are defined with producer, consumer, protocol, data, lifecycle, and error behavior.

## Contracts

PASS

Scenario, site, charger, simulation configuration, result, comparison, API, and error contracts are defined. Baseline results are returned directly and held in memory; `/api/simulations` storage is deferred.

## Dependencies

PASS

Allowed and forbidden dependency directions are documented. No circular dependency is required by the proposed architecture.

## Build

PASS

The baseline package manager, runtime families, database access/migration tooling, and command shapes are documented in `build-system.md`. Patch versions are locked during repository generation.

## Testing

PASS

The baseline uses pytest, Vitest, FastAPI/httpx testing, Docker Compose integration checks, and deterministic JSON fixtures. Playwright and generated contract clients are deferred.

## Implementation Order

PASS

The phases proceed from definition and infrastructure through contracts, data, core simulation, end-to-end MVP, visualisation, comparison, optional sophistication, and handoff.

## Repository Feasibility

PASS

The structure can represent the architecture, selected technologies can coexist, and the baseline can run with deterministic placeholders and in-memory simulation results.

## Deferred Decisions

1. Production authentication, authorisation, TLS, and secret management.
2. Cloud provider and production deployment topology.
3. Persistent simulation-result storage and retention.
4. Playwright/browser automation and generated contract clients.
5. Wider browser support and a real target geography.

These do not block the local baseline because the application uses local no-auth execution, in-memory results, synthetic WGS84 coordinates, and API/unit/integration tests.

## Required Next Step

Proceed to baseline generation. Before implementation, create the lockfiles and container configuration using the selected runtime families, then run the commands in `build-system.md` and record the actual patch versions.
