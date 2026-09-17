# Asset Manager

**Status: planned, not yet implemented.** No code under `packages/assets/` exists yet. This
stub exists so the subsystem index (`docs/README.md`) has one place to find every subsystem,
built or planned; it is not a technical contract for working code.

## Full spec

The full spec — scope, `[REAL]` vs `[SKELETON]` boundary, data shapes, file list, integration
points, and acceptance criteria — lives in
[`2026-09-17--PLAN--asset-manager-vehicle.md`](../07-research-and-history/2026-09-17--PLAN--asset-manager-vehicle.md).

## One-line summary

A pluggable `AssetResolver` interface so the editor, runtime, and backend all resolve an
`AssetRef` (primitive, local catalog, or remote signed-URL media) the same way, so swapping
where an asset lives never requires touching call sites.

## When this file should become the real contract

Once `packages/assets/` exists and passes its own test suite, replace this stub with the
subsystem's actual boundary/ownership/API documentation (matching the style of
[`authoring-engine.md`](authoring-engine.md)), and move the plan doc's remaining relevant
content (decisions made, not the full original spec) into a "Build sequence" or "History"
section here, the way `authoring-engine.md` documents its own slices after they land.
