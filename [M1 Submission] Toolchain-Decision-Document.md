# Toolchain Decision Document

> **M1 scope:** **Process / reference.** Tech-lead deliverable #1.

*Baseline stack and platform decisions for `VectorSpace`. Any change to this document requires instructor approval.*

> **Note on scope:** backend and cloud infrastructure choices (see [Backend / Cloud](#backend--cloud), below) are provisional defaults, not committed decisions — the team has not yet split up ownership of that area for M1.

## Core Language & Runtime

- **TypeScript 5.8.3** — type safety across frontend and shared packages; catches integration bugs at compile time instead of runtime.
- **Python 3.12** — backend language (FastAPI); chosen for fast iteration and strong ecosystem support.
- **Node.js ≥22 / npm ≥10** — required runtime/package-manager versions.

## Build Tooling

- **Vite 6.3.5** — dev server and bundler; fast rebuilds during development.
- **npm workspaces** — manages the monorepo's packages as one install/build graph.

## Frameworks & Rendering

- **React 19.1.0** — UI framework; component structure and state management for the authoring interface.
- **FastAPI 0.115.12** — backend framework; route/schema structure for the (currently stubbed) API layer.
- **Three.js 0.177.0** — 3D rendering. Chosen over raw WebGL (too low-level — hand-written shaders/buffers/draw calls) and Babylon.js (heavier, game-engine-oriented, with built-in physics and its own editor tooling) since this is a UI/editor-focused authoring app, not a game.

## Libraries & Plugins

- Hand-written frontend validation (no external form library).
- **Pydantic v2** — backend request/response schema validation.
- **SQLAlchemy 2.0.36 + Alembic** — ORM and migrations for the (currently unused) Postgres database.
- **@gltf-transform / meshoptimizer** — glTF/GLB asset optimization pipeline (dedup, weld, prune, mesh simplification).
- Hand-written markdown/rich-text parser — scoped to `packages/text`'s WHEN→DO text-panel system, not app-wide.

## AI Tools

- **Claude Code** — used by the tech lead for drafting documentation and code.
- **GitHub Copilot** — via GitHub Student Developer Pack, in-editor code completion.
- **ChatGPT** — ad hoc general-question tool; not integrated into the codebase or pipeline.

## File & Data Formats

- **JSON (ProjectData)** — the project's save format. Human-readable and native to the browser, so it serves both `localStorage` saves and export/import files.
- **glTF/GLB** — 3D model format. Three.js loads it directly, and it is the format the @gltf-transform optimization pipeline works on.
- Static audio files (MP3, OGG, WAV) — common web audio formats that the browser decodes itself.
- Inline-JSON text content — confirmed design (see Data/Content Pipeline doc).
- Image, video, and URL-linked content — anticipated, **not yet confirmed or tested**.

*Database and object-storage formats are covered in Backend / Cloud, below, not duplicated here.*

## Target Devices / Platforms

- **Desktop browser** — primary target for M1. The editor relies on mouse and keyboard (transform gizmos, WASD walk mode), and running in the browser means nothing to install.
- **Tablet/iPad** — Post-M1 primary target (recent change, not yet implemented).
- Mobile and tablet runtime, including older/lower-spec devices — secondary target.
- Native apps and WebXR — explicitly out of scope.

## Backend / Cloud

> **Ownership caveat:** backend and cloud infrastructure are not owned by any individual teammate for M1 — the team has not yet split up ownership of this area, so everything below should be read as provisional defaults, not a commitment anyone is accountable for delivering against this milestone.

- **Database:** PostgreSQL 16 — chosen, models exist, but nothing writes to it yet (every API route besides `/health` is a stub).
- **Object storage:** MinIO locally (S3-compatible), via `boto3` — lets backend code be written against a real S3-style API before committing to a production provider.
- **Auth:** Auth0 (JWT/JWKS validation) — validation code is written and correct, but not yet attached to any route.
- **Hosting:** Self-hosted Docker Compose + Caddy reverse proxy runs locally; the original placeholder, not a final infrastructure commitment. Cloud provider (if any) is undecided.
- **Why placeholder, not decision:** we don't yet know real traffic/storage needs, and picking a vendor now would be a guess dressed up as a decision.

---

*Project5_DoReMi-yaki · M1 Toolchain Decision Document*