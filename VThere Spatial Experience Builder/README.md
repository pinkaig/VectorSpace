# VThere Spatial Experience Builder

A browser-based spatial authoring tool: a Three.js/React editor for placing and arranging objects in a scene, with a Python/FastAPI backend for persistence.

## Current slice

- Shared versioned project model with scenes and scene objects
- Three.js editor viewport with selection and floor-plane drag movement
- Scene tree and primitive asset browser
- Transform inspector for position, rotation, and scale
- Local save/load through `localStorage`, plus JSON export
- Undo/redo snapshots

Interaction definitions, content components, preview/runtime parity, publishing, and full backend persistence are still in progress — see [Getting the Project Running](../../wiki/Getting-the-Project-Running) on the wiki for exactly what's wired up today.

## Run it

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. This starts the editor only — no Python/Docker needed. For the full stack (API + Postgres + MinIO) and troubleshooting, see [Getting the Project Running](../../wiki/Getting-the-Project-Running).

## Docs

- [GitHub wiki](../../wiki) — M1 deliverables: architecture, tech stack, build/CI pipeline, project setup, testbed spec
- [`docs/README.md`](docs/README.md) — in-repo reference docs (subsystem contracts, engineering practices) tied to current code
