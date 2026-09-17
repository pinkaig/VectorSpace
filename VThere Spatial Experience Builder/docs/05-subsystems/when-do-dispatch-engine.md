# WHEN→DO Dispatch Engine

**Status: planned, not yet implemented, now unblocked.** No code under
`packages/interaction/` exists yet. Phase 2 (the command-path service this engine was gated
on) merged this session, so real implementation work can start. This stub exists so the
subsystem index (`docs/README.md`) has one place to find every subsystem, built or planned; it
is not a technical contract for working code.

## Full spec

The full spec — scope, `[REAL]` vs `[SKELETON]` boundary, data shapes, file list, integration
points, and acceptance criteria — lives in
[`2026-09-17--PLAN--when-do-dispatch-engine.md`](../07-research-and-history/2026-09-17--PLAN--when-do-dispatch-engine.md).

## One-line summary

A pure `dispatch(event, rules, project, state) → DispatchResult` function that runs interaction
rules (click → rule match → action) without owning rendering, persistence, or the rule
vocabulary itself — the vehicle, not the vocabulary.

## When this file should become the real contract

Once `packages/interaction/` exists and passes its own test suite, replace this stub with the
subsystem's actual boundary/ownership/API documentation (matching the style of
[`authoring-engine.md`](authoring-engine.md)).
