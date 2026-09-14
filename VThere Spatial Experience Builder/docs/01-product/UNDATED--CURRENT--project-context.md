# VThere Spatial Experience Builder â€” Project Context

## Identity

VThere is a browser-based no-code spatial exhibition authoring tool. Authors build scenes from approved assets, define WHEN -> DO interactions, preview them, and publish a visitor URL.

## Current phase

Stage 4 Phase 0 baseline in progress. The existing client remains a Phase 1/2 visual spike while the canonical project package, authoring-engine history seam, and API health scaffold are established. Backend project persistence, runtime separation, and production persistence are not implemented.

## Architecture

- **Editor:** React UI and Three.js viewport for authoring.
- **Shared core:** TypeScript project model, scene graph, components, spatial math, interaction definitions, serialization, validation, commands, and the standalone custom `authoring-engine`.
- **Runtime:** separate visitor-facing application consuming the same project document and interaction engine.
- **API:** FastAPI service for auth, projects, versions, assets, publishing, and analytics.
- **Persistence:** PostgreSQL for structured metadata; S3-compatible object storage for large assets/media; CDN for published delivery.

## Stack

TypeScript, React 19, Vite 6, Three.js 0.177, Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL 16, MinIO locally, Google Cloud Storage/Cloud CDN in the reference deployment, Auth0 OIDC, Vitest, Playwright, pytest, HTTPX, Docker Compose.

## Key constraints

The runtime has no editing capability. Editor and runtime consume one versioned project representation. Gizmos, serialization, interaction dispatch, and undo/redo remain custom project-owned work. Persistence is release-blocking: autosave status must be truthful, corrupt drafts must recover through a tested fallback chain, and published versions are immutable. Arbitrary model conversion, scripting, collaboration, WebXR, native apps, billing, and LMS/SCORM are outside MVP.

## Baseline status

Partially ready. Node.js/npm and Python are installed; the frontend build, focused Vitest test, and API health test pass. Human architecture approval, the editor move into `apps/editor/`, broader tests, and the remaining shared/API/runtime packages are still required.

## Entry points

- Client: `npm install`, `npm run dev`, `npm run build`
- API after baseline scaffold: `python -m pytest`, `uvicorn app.main:app --reload`
- Local services after infrastructure scaffold: `docker compose up -d postgres minio`

## Architecture drift rules

Agents may implement existing interfaces, add tests, add files inside extensible directories, and fix defects. Agents may not silently rename canonical systems, move fixed boundaries, change technologies, replace frameworks, change protocols, change public contracts, add major dependencies, create top-level systems, or change subsystem responsibilities. Architectural conflicts must stop for a decision.

See `../02-architecture/UNDATED--FOUNDATION--architecture.md`, `../02-architecture/UNDATED--FOUNDATION--repository.md`, `../02-architecture/UNDATED--FOUNDATION--contracts.md`, `../02-architecture/UNDATED--FOUNDATION--build-system.md`, `../03-delivery/UNDATED--FOUNDATION--testing-strategy.md`, `../03-delivery/UNDATED--FOUNDATION--implementation-plan.md`, `../05-subsystems/authoring-engine.md`, `../05-subsystems/UNDATED--CURRENT--asset-library-contract.md`, `../03-delivery/UNDATED--GOVERNANCE--roles-and-delivery.md`, `../07-research-and-history/UNDATED--GOVERNANCE--pilot-and-conduct.md`, `2026-09-06--HISTORY--source-brief-audit.md`, and `../03-delivery/UNDATED--CURRENT--pre-baseline-validation.md`.
