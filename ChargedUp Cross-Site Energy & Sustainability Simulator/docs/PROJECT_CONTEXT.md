# Project Context

## Identity

GAM300 Project 3: ChargedUp Cross-Site Energy & Sustainability Simulator.

## Purpose

A browser-based decision-support simulator showing how fleet charging decisions across depots and external charging sites affect demand, cost, capacity, utilisation, and indicative emissions.

## Current phase

Pre-baseline architecture planning. Scope and technology stack are approved for planning. No implementation repository exists yet.

## High-level architecture

```text
React + CesiumJS
        │ HTTP/JSON/GeoJSON
        ▼
FastAPI + Pydantic application services
        │ in-process typed calls
        ▼
Independent Python simulation domain
        │ repository interfaces
        ▼
PostgreSQL + PostGIS
```

The simulation domain must not depend on HTTP, FastAPI routing, React, CesiumJS, or PostgreSQL implementation details.

## Major subsystems

- Frontend application and API client.
- HTTP API and application services.
- Simulation domain: clock, fleet, charging, sites, capacity, energy, cost, emissions, and result aggregation.
- Scenario comparison.
- Repository/data access and GIS preparation.
- PostgreSQL/PostGIS infrastructure.
- CI, Docker, test, and configuration infrastructure.

## Baseline boundary

The baseline must prove that the repository builds, the frontend reaches the backend, validated scenarios reach an independent simulation interface, a deterministic 24-hour result returns, database connectivity exists, and baseline site/result data can reach CesiumJS, charts, KPIs, and a time controller.

It does not implement live telemetry, streaming, utility control, detailed electrical physics, full accounting, or advanced optimisation.

## Canonical baseline scenario

A synthetic small network with fleet vehicles, depot and external sites, chargers, a 24-hour day, a configurable timestep with 15 minutes recommended, grid-only energy, disabled BESS and solar, and fixed emissions/ICE assumptions.

## Technology stack

TypeScript, React, CesiumJS, Python, FastAPI, Pydantic, PostgreSQL, PostGIS, GeoJSON, GeoPandas, Shapely, PyProj, NumPy, Pandas, HTTP/REST/JSON, Docker, Docker Compose, GitHub, and CI/CD direction.

Baseline choices are Node.js 22/npm, Python 3.12/pip, PostgreSQL 16/PostGIS 3.4, SQLAlchemy 2/Alembic, pytest, Vitest, Recharts, and GitHub Actions. Simulation results are in-memory for the baseline. Production cloud deployment, authentication, and generated contract clients are explicit deferred placeholders.

## Primary references

- `projectscope.md`
- `techstack.md`
- `docs/architecture.md`
- `docs/repository.md`
- `docs/integration.md`
- `docs/contracts.md`
- `docs/dependency-graph.md`
- `docs/build-system.md`
- `docs/testing-strategy.md`
- `docs/security-and-stress-testing.md`
- `docs/implementation-plan.md`
- `docs/subsystems/simulation-domain.md`
