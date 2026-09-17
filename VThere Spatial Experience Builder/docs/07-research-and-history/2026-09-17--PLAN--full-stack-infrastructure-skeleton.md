# Plan: Full-Stack Infrastructure Skeleton — VThere
**Date:** 2026-09-17  
**Author:** Claude Haiku 4.5  
**Status:** Approved for implementation  

## Context

This plan establishes the scaffolding for a complete tech lead infrastructure effort: editor
(frontend) → shared domain core → backend API → persistence → object storage → cloud
hosting. The team already started building custom gizmos; this work **excludes gizmos and
gizmo mathematics entirely** and focuses on architecture skeleton and working plumbing.

The tech lead was questioned about AI authorship and project learning value. This plan
explicitly addresses that concern:

- **AI produces only scaffolding** — real type signatures, real method shapes, real
  docstrings citing acceptance criteria from the spec, bodies that are `NotImplementedError`
  / `raise NotImplementedError`. Teammates implement the logic themselves.
- **Infrastructure is real and working** — dependencies installed, DB connected, Docker
  Compose actually starts, routes actually registered, deploy config actually deployable.
- **Documentation is written alongside code** — every file gets a source header (following
  `source-file-header-standard.md` already in the repo), every subsystem gets a system
  Markdown page describing architecture, risks, and open questions.
- **Skeleton shows real shape** — not one-liners, but full class shapes with every member
  field and method signature visible, so the architecture is transparent.

## Deliverables by Category

### Infrastructure ([REAL] — fully working)
- Docker Compose with Postgres 16, MinIO
- Backend configuration using pydantic-settings
- SQLAlchemy 2.x engine and session factory
- Alembic database migrations (real, runnable)
- FastAPI router registration and Pydantic request/response types
- Auth0 JWT validation (python-jose)
- S3/MinIO presigned-URL client (boto3)
- Production Docker/Compose/Caddy reverse-proxy stack
- GitHub Actions deploy workflow (SSH-based)

### Domain Logic ([SKELETON] — signatures + docstring + NotImplementedError)
- `ProjectRepository` — get/save/list_versions with revision-conflict checking
- `PublishingService` — publish/resolve_published with immutability invariant
- `AccessControl` — can_read/can_write/assert_write with isolation invariant
- HTTP handlers — all paths routed and registered, but returning 501 Not Implemented
- `packages/interaction` dispatch engine — WHEN→DO matching with ordering + zone-entry-once semantics

### Documentation
- `docs/05-subsystems/backend-persistence.md`
- `docs/05-subsystems/backend-api-surface.md`
- `docs/05-subsystems/publishing-and-access.md`
- `docs/05-subsystems/interaction-engine.md`
- `docs/04-engineering/deployment.md`

### Database Models ([REAL] structure)
SQLAlchemy ORM with full column definitions:
- `Organisation`, `Actor` (identity, org isolation)
- `Project`, `ProjectVersion` (canonical document + revision history)
- `PublicationRecord` (immutable snapshots)
- `AssetReference` (storage metadata)
- `AnalyticsEvent` (event types + JSONB payloads)

## How This Unfolds Across Context Windows

This is too large for one turn. After each stage completes, I'll update a running log:
`docs/07-research-and-history/2026-09-17--SKELETON--full-stack-infrastructure-log.md`

That log records: what was added, decisions made, blockers, and what's next. If this
conversation compacts or clears, a fresh session picks up from the log, not from
conversation memory.

## Acceptance

Each stage is verified before moving to the next:
- `docker compose up -d` — passes health checks
- `alembic upgrade head` — creates real tables
- `python -m uvicorn app.main:app --reload` — all routes registered
- `npm run test -- packages/interaction` — imports work
- Docker builds pass — `docker build` succeeds
- Type checking passes — `python -m pytest`, `npm run typecheck`

## Next Steps

1. Commit this plan as a Markdown doc (this file)
2. Update `SESSION.md` with Phase 2 + skeleton effort notes
3. Begin Stage 1 (local infrastructure)
