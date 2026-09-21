# WHEN→DO Engine — the event dispatch vehicle

**Status:** Planned, not yet implemented. **Now unblocked** — was gated on Phase 2
(command-path service), which merged this session (`573def4`, `c027666`). Per
`2026-09-17--HANDOFF--when-do-runtime-logic-considerations.md`, only type/dispatch *design*
was pre-approved before Phase 2; the real `packages/interaction` code was told to wait. That

**Baseline phase:** Stage 4b (WHEN→DO Engine). See [8-stage baseline overview](../../code/baseline-phases.md).
wait condition is satisfied now.
**Origin:** Extracted from `2026-09-17--PLAN--infrastructure-skeleton-extended.md` (Stage 4b +
Stage 7) into its own file per the 2026-09-17 frontend-business-logic-backlog split.
**Tracking:** row 10 in `2026-09-17--PLAN--frontend-business-logic-backlog.md`.
**Subsystem index entry:** `docs/05-subsystems/when-do-dispatch-engine.md` (stub, links back
here).
**Suggested model/effort tier:** Opus 5 + Plan Mode. This is the architecturally load-bearing
step in the current backlog: a wrong first draft of the dispatch contract or its wiring into
the render loop is expensive to unwind once rules and runtime state depend on it.

## What it is

The infrastructure that *runs* interaction rules — not the rule vocabulary itself. It answers
"given this event, these rules, this project, and this runtime state, what should happen
next," as a pure function, with no opinion about which trigger/action kinds exist.

## [REAL] infrastructure — build this now, no domain decisions about *which* triggers/actions

- `packages/interaction/src/RuntimeEvent.ts`:
  ```ts
  interface RuntimeEvent {
    kind: string
    objectId?: string
    zoneId?: string
    payload?: Record<string, unknown>
  }
  ```
- `packages/interaction/src/RuntimeState.ts`:
  ```ts
  interface RuntimeState {
    visitedZones: Set<string>
    currentSceneId: string
    runtimeData?: object
  }
  ```
- `packages/interaction/src/DispatchResult.ts`:
  ```ts
  interface DispatchResult {
    eventsMatched: RuntimeEvent[]
    actionsExecuted: Action[]
    nextState: RuntimeState
  }
  ```
- `packages/interaction/src/dispatcher.ts` — pure function:
  ```ts
  dispatch(event: RuntimeEvent, rules: InteractionRule[], project: ProjectData, state: RuntimeState): DispatchResult
  ```
  - No I/O, no rendering — fully testable against fixtures, same style as
    `packages/authoring-engine`'s framework-free tests.
  - Rule matching by object id / zone id / trigger kind.
  - **Deterministic order**: rules fire in authoring order when more than one rule matches the
    same object — this must be a tested guarantee, not an incidental array-iteration side
    effect.
  - Action *execution framework* (the dispatch loop that calls action executors), not action
    *implementations* — those are a separate, pluggable concern (see below).
  - Side-effect isolation: `dispatch()` returns what *should* happen; a separate executor
    layer applies it. Nothing in `dispatcher.ts` touches the DOM, Three.js, or audio directly.

## [SKELETON] domain logic — deferred, but the shape is fixed now

- `InteractionRule` data structure:
  ```ts
  interface InteractionRule {
    id: string
    objectId: string
    zoneId?: string
    triggers: string[]
    actions: string[]
    priority?: number
  }
  ```
- Rule validation: no orphaned object/zone references, rule ID uniqueness, acyclic
  dependencies (a rule's own actions must not be able to re-trigger itself in a way that loops
  forever within one dispatch call).
- Action executors (pluggable per kind), signature fixed now, bodies deferred:
  ```ts
  executeAction(action: Action, assets: AssetResolver, state: RuntimeState): Promise<RuntimeState>
  ```
  - `showPanel(componentId)` → render function (deferred to whoever owns Inspector/runtime UI).
  - `playAudio(assetId)` → player control (uses the Asset Manager resolver, not a direct URL).
  - `navigateScene(sceneId)` → navigation function.
  - New actions must be addable without touching `dispatcher.ts` — this is the acceptance
    test, not just a design goal.

## Integration points

- Gizmo/pointer interaction (`src/viewport/interactionController.ts`) sends a `RuntimeEvent`
  to the dispatcher on relevant input (e.g. click → `{ kind: 'click', objectId }`). This is a
  new call site, not a change to existing gizmo drag/transform code — the two are independent
  event paths.
- The dispatcher's returned actions are applied by a runtime/editor executor — rendering a
  panel, playing a sound, navigating — kept separate from `dispatch()` itself.
- Rules are persisted as `ProjectData.rules: InteractionRule[]`, versioned like every other
  project field.
- Undo/redo needs **no new work**: `CommandTimeline` already stores whole `ProjectData`
  snapshots (confirmed pattern from parent-child slices 1-2 and transform inheritance slice
  5), so `rules` participates in undo/redo automatically once it's a `ProjectData` field.

## Files to create

```
packages/interaction/
  package.json           ("exports": "./src/index.ts")
  src/
    index.ts
    RuntimeEvent.ts
    RuntimeState.ts
    DispatchResult.ts
    InteractionRule.ts
    dispatcher.ts
    actions/
      types.ts            (Action, executeAction signature)
      registry.ts          (pluggable action-kind → executor map)
    dispatcher.test.ts     (rule ordering, event matching, no-duplicate-fire, idempotency)
```

## Acceptance criteria

- `npm run test -- packages/interaction` passes.
- New event kinds or action kinds can be added without changing `dispatcher.ts` or breaking
  existing rule tests.
- Multiple rules on one object fire in a defined, tested order (authoring order).
- End-to-end wiring (Stage 7 half of this doc): click → event → rule match → action →
  UI/audio/navigation effect, exercised in at least one integration test once the executor
  layer exists.

## Dependencies

- Needs `InteractionRule` added to `ProjectData` schema (small, additive — same pattern as
  `parentId` in parent-child slices 1-2) before the persisted-rules integration point is real;
  the dispatcher itself can be built and tested against fixtures without that schema change
  landing first.
- Benefits from the Asset Manager vehicle (`2026-09-17--PLAN--asset-manager-vehicle.md`) for
  the `playAudio` action executor, but is not blocked by it — that executor can stay a
  skeleton until Asset Manager lands.
