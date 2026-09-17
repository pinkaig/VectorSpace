# Local→Cloud Sync Engine

**Status: planned, not yet implemented.** No code under `packages/sync/` exists yet. This stub
exists so the subsystem index (`docs/README.md`) has one place to find every subsystem, built
or planned; it is not a technical contract for working code.

## Full spec

The full spec — scope, `[REAL]` vs `[SKELETON]` boundary, data shapes, file list, integration
points, and acceptance criteria — lives in
[`2026-09-17--PLAN--sync-engine-vehicle.md`](../07-research-and-history/2026-09-17--PLAN--sync-engine-vehicle.md).

## One-line summary

A queue/client/result vehicle (`SyncQueue`, `SyncClient`, `SyncResult`) that makes the existing
`localStorage` autosave (`src/serializer.ts`) durable across devices via dual-write staging,
revision-based conflict detection, and idempotent retries — the sync mechanics, not the
conflict-resolution policy.

## When this file should become the real contract

Once `packages/sync/` exists and passes its own test suite, replace this stub with the
subsystem's actual boundary/ownership/API documentation (matching the style of
[`authoring-engine.md`](authoring-engine.md)).
