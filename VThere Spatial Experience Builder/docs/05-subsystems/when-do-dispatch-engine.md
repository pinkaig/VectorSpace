# WHEN→DO Dispatch Engine

**Status: implemented.** `packages/interaction/` exists and is wired into the live viewport.
This file is the subsystem's contract; the design rationale behind it lives in
[`2026-09-17--DESIGN--when-do-runtime-architecture.md`](../07-research-and-history/2026-09-17--DESIGN--when-do-runtime-architecture.md).

## What this subsystem is

The vehicle that turns authored interaction rules into runtime behaviour. A visitor clicks an
artefact or walks into a zone; a rule matches; something happens — a panel opens, audio plays,
the scene navigates.

It is deliberately **not** the rule vocabulary. It has no opinion about which triggers or actions
exist. Adding `gazeDwell` as a trigger or `startHaptics` as an action requires no change to any
file in this package — that independence is enforced by a test, not just intended.

## The concept: three tiers, and why it is a hybrid

The obvious designs both fail here, in opposite directions.

**Pure per-frame polling** — the approach the reference `SLogic` C++ system took, checking every
scripted entity every frame — wastes work in a browser. A click is a real event the platform
already detects; re-deriving it by polling is both slower to respond and more expensive.

**Pure event listening** fails the other way: the browser fires no event for "the visitor walked
into this volume." Nothing will tell you unless you check.

So the split follows what the platform actually gives us:

| Tier | Concern | Mechanism |
|---|---|---|
| **1** | WHEN detection | Real DOM listeners for click/hover/key. Explicit calls for lifecycle (`sceneStart`). **Polling only** for spatial/zone conditions, because nothing else can detect them. |
| **2** | Matching | `dispatch()` — pure, synchronous, called once per emitted event and never once per frame. |
| **3** | DO execution with duration | `ActionSequencer`, generator-based, ticked once per RAF frame. |

The load-bearing detail is that **zone polling is edge-triggered inside the event source**. The
tracker keeps a per-zone occupancy set and diffs it frame to frame, emitting a `zoneEnter` or
`zoneExit` only on a transition. A visitor standing still inside a zone produces exactly one event,
not one per frame. Everything downstream of Tier 1 is therefore event-shaped, and the dispatcher
never has to run "every frame" even though one of its sources is a poll.

### Advantages this buys

- **`dispatch()` is pure**, so it is testable against fixtures with no renderer, no DOM, and no
  clock — 15 of its tests run in single-digit milliseconds.
- **Input stays as responsive as the browser**, since clicks are never waiting on a frame boundary.
- **Timing lives in one place.** Generators express "fade, wait 2s, then show a panel" as
  straight-line code, while the dispatcher stays free of async concerns entirely.
- **Reset is nearly free.** Because DO actions mutate Three.js imperatively and never touch
  `ProjectData`, restoring the scene is just letting the existing `syncObjects()` reconciliation
  redraw from a snapshot that was never modified. No inverse-action bookkeeping.
- **New vocabulary is additive.** Register an executor; nothing else changes.

## API

Everything is exported from `@vthere/interaction`'s single entry point (`src/index.ts` — subpath
imports do not resolve).

```ts
dispatch(event, rules, project, state) → DispatchResult
```

Pure and synchronous. No I/O, no DOM, no Three.js, no audio, and it executes nothing — it returns
what *should* happen and the caller applies it.

- `RuntimeEvent` — `{ kind, objectId?, zoneId?, payload? }`
- `RuntimeState` — `{ visitedZones, currentSceneId, runtimeData? }`, plus `createRuntimeState()`
  and `cloneRuntimeState()`
- `InteractionRule` / `ActionSpec` — re-exported from `@vthere/project`, since rules are persisted
  data and must have exactly one definition
- `DispatchResult` — `{ rulesMatched, actions, nextState }`

**Matching**: a rule matches when the event's kind is among its triggers, and neither `objectId`
nor `zoneId` contradicts the event. An absent address field is a wildcard — which is what lets a
`sceneStart` rule, naming no object, match at all.

**Ordering**: `priority` descending (absent = 0), then authoring array order as a stable tiebreak.
Both halves are tested.

**Other exports**: `createZoneTracker`, `createActionSequencer` + `waitSeconds`,
`createActionRegistry`, `createEffectRegistry`, `resetRuntime`.

## How it is wired into the viewport

All three tiers hook into the RAF loop that already existed in `Viewport.tsx`'s `animate()` — no
second loop was added.

- **Mode gating** is an explicit `runtimeMode: 'edit' | 'play'` prop, plumbed through the same
  `dataRef` the viewport already uses. It is *not* `interactive`, which only toggles gizmo
  interactivity: authoring with gizmos off must still never fire rules. Edit mode falls straight
  past the runtime block, and the interaction controller checks `runtimeActive` before doing any
  extra picking, so authoring costs nothing.
- **Tier 1 input** rides `interactionController.ts`'s existing listeners via one new
  `onRuntimeEvent` callback. Hover is edge-triggered the same way zones are. Click reuses the 4px
  travel rule that already distinguishes a click from a drag.
- **Tier 1 spatial** ticks the zone tracker against the viewer camera's live world position.
- **Tier 3** ticks the sequencer with the `delta` the loop already computes.
- **`resetRuntime()`** is shared by "Restart scene" (restart in place, re-firing `sceneStart`) and
  "Exit simulation" (teardown via unmount).

## Boundaries

- DO actions that change the 3D scene mutate Three.js objects **imperatively**, never through
  `commit()`/`CommandTimeline`. A runtime action must never create a history entry.
- Non-scene side effects (panels, audio) **must** register a disposer with the `EffectRegistry`.
  Anything outside the Three.js scene graph is invisible to reconciliation and will leak across a
  reset otherwise. This is the known bug class here; `registry.add()` returning the handle is what
  makes registration the only way to create one.
- `ProjectData` must not be edited while a play session is live. The whole "visual reset is free"
  property depends on the snapshot staying stable for the session.

## Persistence, cloud, and security boundary

**Rules and zones are persisted; runtime state is not.** That split is the main thing to understand
here.

- `ProjectData.rules` and `SceneData.zones` are ordinary project fields. They flow through the
  existing chain: `serializer.ts` → localStorage → `packages/sync`'s queue → the backend's
  `/projects/{id}/rules` router. Both are optional and backfilled to `[]` on load, so
  `schemaVersion` stays `1` — the same additive migration pattern as `visible`, `enabled`, and
  `parentId`.
- The backend table already exists (`apps/api/app/models.py`, `interaction_rules`) with matching
  columns — `object_id`, `zone_id`, `triggers`, `actions`, `priority`. **Its handlers still return
  501.** The shapes are aligned now so the wire connects later without a migration.
- Because rules live in `ProjectData`, **undo/redo needs no new work**: `CommandTimeline` stores
  whole-project snapshots, so editing a rule is undoable for free.
- **`RuntimeState` never leaves the session.** It is created when play starts, discarded by
  `resetRuntime()`, never written back into `ProjectData`, never serialized, and never queued for
  sync. A visitor session leaves no server-side trace through this path.

On security specifically:

- **`dispatch()` cannot leak anything.** It performs no I/O by construction, so the matching core
  is not a surface at all.
- **The surface is the executor layer.** `playAudio` must resolve through the Asset Manager, which
  issues signed URLs with a TTL — never a raw URL baked into a rule. `showPanel` is where
  untrusted-HTML injection would matter *if* panel content ever becomes author-supplied rich text;
  whoever builds that executor owns escaping it.
- **Validation happens at load, not at dispatch.** `serializer.ts` rejects duplicate rule/zone ids,
  malformed actions, and orphaned object/zone references, so a rule that could never fire is caught
  when the project opens rather than failing silently in front of a visitor.
- **Auth is unchanged.** `apps/api/app/auth.py` (Auth0 JWKS/JWT) already scopes rules by project;
  this subsystem adds no new auth surface.

## Tests

60 tests across five modules, all framework-free:

| File | Covers |
|---|---|
| `dispatcher.test.ts` (15) | matching, authoring/priority order, state immutability, vocabulary independence |
| `ActionSequencer.test.ts` (16) | per-tick stepping, `waitSeconds` accumulation, stop/stopAll with `finally`, throw isolation, frame-budget guard |
| `zoneTracker.test.ts` (10) | one event per transition, no repeat while inside, re-entry, box/sphere geometry, reset |
| `registry.test.ts` (10) | executor plug-in, unknown-kind skip, effect disposal order and throw isolation |
| `resetRuntime.test.ts` (9) | sequencer stop, effect disposal, zone re-arm, state discard vs. recreation |

Run with `npm.cmd test -- packages/interaction`.

## Deferred

Editor UI for authoring rules and zones (Inspector panels), runtime UI for presenting actions
(panel styling, audio controls), the concrete action vocabulary beyond the registry that hosts it,
an in-editor Preview toggle (the mode flag leaves the seam; the button is not built), and spatial
partitioning for zone polling — a naive scan is correct until object counts make it measurably
expensive.
