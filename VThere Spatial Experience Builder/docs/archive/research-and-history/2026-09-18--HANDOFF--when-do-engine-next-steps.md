# Handoff: WHEN→DO Engine Landed — What's Next

**Date:** 2026-09-18
**Status:** Stage 4b + Stage 7 committed (`8416364`) on
`Full-Skeleton-ver-2-Industry-Project-5---Spatial-Experience-Builder`, not yet pushed.
**For:** whoever picks up rule/zone authoring or action executors next.

**Baseline phase:** Stage 4b + 7 (WHEN→DO engine). See [8-stage baseline overview](../../code/baseline-phases.md).

## What landed

`packages/interaction` (pure `dispatch()`, edge-triggered zone tracker, generator-based
`ActionSequencer`, action/effect registries, `resetRuntime()`) is built, tested, and wired into
`Viewport.tsx`'s existing RAF loop behind a `runtimeMode` prop. `RuntimeView` runs in play mode
with a new "Restart scene" control. `ProjectData.rules` / `SceneData.zones` exist as an additive
schema migration.

**Read these two docs before touching this subsystem — do not re-derive from source:**
- [`docs/05-subsystems/when-do-dispatch-engine.md`](../05-subsystems/when-do-dispatch-engine.md) —
  the actual contract: API, wiring points, persistence/security boundary.
- [`2026-09-17--HANDOFF--when-do-runtime-logic-considerations.md`](2026-09-17--HANDOFF--when-do-runtime-logic-considerations.md)'s
  "Implementation outcome" section (appended 2026-09-18) — the five deliberate deviations from the
  original spec doc, the off-by-one-frame bug found and fixed in `ActionSequencer`, and exact test
  counts.

Verification at commit time: `npm run typecheck` clean, `npm test` 205 passed (28 files, 64 new),
`npm run build` succeeds.

## What is deliberately NOT done, and why it blocks a real demo

Two things stand between this commit and a visible end-to-end demo in the running app:

1. **The action registry is empty.** `createActionRegistry()` exists and `dispatch()` correctly
   returns actions to run, but no one has called `registry.register('showPanel', …)` anywhere in
   `Viewport.tsx` or elsewhere. Right now a matched rule's actions are silently no-ops (by design —
   see `registry.ts`'s "unregistered kind" comment — but that means nothing visibly happens yet).
2. **No authoring UI for rules or zones.** `InteractionRule[]` and `ZoneDefinition[]` are real,
   validated, undo/redo-safe project fields, but the only way to populate them today is hand-editing
   exported project JSON and re-importing it. There is no Inspector panel.

Neither was in scope for this slice — both are named as deferred in the design docs — but they are
the natural next slices and probably the ones a user will ask for next.

## Suggested next steps, in order

1. **Wire at least one real executor** (`showPanel` is the simplest — no Asset Manager dependency)
   into `Viewport.tsx`'s `actions.register(...)` calls, so a hand-authored rule can be seen working
   end-to-end in `RuntimeView`. This is the fastest path to a demonstrable result and will surface
   any wiring gaps the unit/integration tests didn't (they run with no renderer).
2. **`playAudio`** next — exercises the Asset Manager signed-URL path the security section of the
   subsystem doc calls out; do this before any executor takes free-form URLs.
3. **Rule/zone authoring UI** is a larger, separate piece of work (Inspector panels, zone gizmos in
   the viewport) — likely its own planned slice, not a quick add-on.
4. If zone polling performance ever becomes a real concern (many zones, many objects), the
   subsystem doc already names that as explicitly deferred — don't pre-optimize before it's needed.

## Repo state

- Branch: `Full-Skeleton-ver-2-Industry-Project-5---Spatial-Experience-Builder`
- Last commit: `8416364` "Add Stage 4b + 7: WHEN->DO engine + viewport wiring" — **local only, not
  pushed**
- Working tree: clean as of this commit
- `SESSION.md`'s stage-readiness table has been updated to mark Stage 4b/7 done
