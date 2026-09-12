# Repository Skeleton

## Classification

```text
VThere Spatial Experience Builder/
├── apps/                         EXTENSIBLE
│   ├── editor/                   FIXED boundary, EXTENSIBLE contents
│   ├── runtime/                  FIXED boundary, EXTENSIBLE contents
│   └── api/                      FIXED boundary, EXTENSIBLE contents
├── packages/                     FIXED boundary, EXTENSIBLE contents
│   ├── project/                  FIXED canonical domain
│   ├── spatial/                  FIXED custom math
│   ├── interaction/              FIXED shared behaviour
│   ├── serialization/            FIXED schema/migrations
│   ├── commands/                 FIXED editing history
│   ├── authoring-engine/         FIXED standalone custom authoring component
│   ├── validation/               FIXED correctness rules
│   └── assets/                   FIXED asset contracts
├── infrastructure/               FIXED boundary, EXTENSIBLE deployment details
│   ├── database/                 EXTENSIBLE
│   ├── storage/                  EXTENSIBLE
│   ├── deployment/                EXTENSIBLE
│   └── docker/                    EXTENSIBLE
├── tests/                        FIXED boundary, EXTENSIBLE suites
├── docs/                         FIXED planning/design documents
├── package.json                  FIXED client workspace entry point
└── package-lock.json              GENERATED and committed after npm install
```

The current `src/` prototype is a temporary implementation surface. During baseline generation it should move into `apps/editor/src/` and `packages/` only when the corresponding boundaries exist; do not silently create parallel domain models. `packages/authoring-engine/` must remain independently testable without React, Three.js rendering, API access, or browser storage.

## Naming and placement

- TypeScript classes/types use PascalCase; files match the canonical type where practical.
- React components use PascalCase `.tsx` filenames.
- Tests live beside small package units or under the owning app's `tests/`; cross-system tests live under root `tests/`.
- Python API modules use snake_case and live only under `apps/api/`.
- Database migrations are generated artifacts owned by `infrastructure/database/`.
- Build output, `node_modules`, virtual environments, secrets, and local media are GENERATED/ignored.

## Architectural component rule

A new top-level directory, protocol, external service, or canonical subsystem is an architectural change. Stop, document the conflict, and obtain a decision. A new private implementation file inside an existing boundary is not an architectural component.
