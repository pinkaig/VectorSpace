# Architecture v1.0 (M2) — PROJ5-198

Full written guide: the project wiki's **Architecture** page (also Architecture-Diagram, API-and-Data-Flow).
Diagram: `[M2 Submission] Architecture v1.0 Diagram.png` (M1 version: `[M1 Submission] Architecture v0.1 Diagram.png`).

## Layers

```
Browser (React + Vite, src/)        pages: student, teacher, admin, editor
        │ uses
packages/ (VectorSpace/packages)    authoring-engine, interaction, project, sync,
                                    text, audio, assets, debugging
        │ HTTPS + Auth0 token
apps/api (FastAPI, on Render)       routes, role checks, error envelope
        │
Postgres (Neon)  ·  Object storage (MinIO local / R2 deployed)  ·  Auth0
```

## Core flow (M2 scope)

School and accounts (admin) → teacher assigns a project → student builds it in the editor → student submits → teacher approves or sends it back → publish.

## Cross-cutting

- **Auth:** Auth0 issues the token, and the API maps it to a roster row (role, school, class).
- **Errors:** every API error uses one envelope (`detail`, `code`, `requestId`). The UI shows a readable sentence, and `src/ErrorBoundary.tsx` catches page crashes.
- **Contract:** `openapi.yaml` is re-exported from the API and checked by the Postman/Newman tests in CI.
- **Each package** has its own README and CHANGELOG.
