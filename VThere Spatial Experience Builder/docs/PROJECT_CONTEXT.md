# VThere Spatial Experience Builder — Project Context

## Identity

VThere is a browser-based no-code spatial exhibition authoring tool. Authors build scenes from approved assets, define WHEN -> DO interactions, preview them, and publish a visitor URL.

## Current phase

Stage 3 pre-baseline architecture. The existing client is a Phase 1/2 visual spike. Backend, runtime separation, and production persistence are not implemented.

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

Not ready. The skeleton needs human review, Node.js/npm installation, lockfile generation, backend scaffold, and verified build/test commands.

## Entry points

- Client: `npm install`, `npm run dev`, `npm run build`
- API after baseline scaffold: `python -m pytest`, `uvicorn app.main:app --reload`
- Local services after infrastructure scaffold: `docker compose up -d postgres minio`

## Architecture drift rules

Agents may implement existing interfaces, add tests, add files inside extensible directories, and fix defects. Agents may not silently rename canonical systems, move fixed boundaries, change technologies, replace frameworks, change protocols, change public contracts, add major dependencies, create top-level systems, or change subsystem responsibilities. Architectural conflicts must stop for a decision.

See `docs/architecture.md`, `docs/repository.md`, `docs/contracts.md`, `docs/build-system.md`, `docs/testing-strategy.md`, `docs/implementation-plan.md`, `docs/subsystems/authoring-engine.md`, `docs/asset-library-contract.md`, `docs/roles-and-delivery.md`, `docs/pilot-and-conduct.md`, `docs/source-brief-audit.md`, and `docs/pre-baseline-validation.md`.
