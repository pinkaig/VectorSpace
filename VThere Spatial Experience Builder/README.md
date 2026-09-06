# VThere Spatial Experience Builder

Initial Phase 1 and Phase 2 implementation for the browser-based spatial authoring tool.

## Current slice

- Shared versioned project model with scenes and scene objects
- Three.js editor viewport with selection and floor-plane drag movement
- Scene tree and primitive asset browser
- Transform inspector for position, rotation, and scale
- Local save/load through `localStorage`
- JSON export
- Undo/redo snapshots

## Run

```bash
npm install
npm run dev
```

The current implementation is the technical spike and editor foundation. Interaction definitions, content components, preview/runtime parity, publishing, and backend persistence follow in later phases.

## Development guide

See [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) for folder navigation, file ownership, business-logic implementation order, persistence/history rules, and verification commands.

For first-time machine setup and missing-tool diagnostics, see [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md).
