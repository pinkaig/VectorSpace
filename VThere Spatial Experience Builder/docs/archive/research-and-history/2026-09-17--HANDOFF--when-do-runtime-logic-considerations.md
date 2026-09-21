# Handoff: WHEN→DO Runtime Logic System Considerations

**Date:** 2026-09-17
**Status:** **Implemented 2026-09-18.** This document is now historical; the subsystem contract
lives in [`docs/05-subsystems/when-do-dispatch-engine.md`](../05-subsystems/when-do-dispatch-engine.md).
See "Implementation outcome" at the foot of this file for what was actually built and where it

**Baseline phase:** Stage 4b + 7 (WHEN→DO engine). See [8-stage baseline overview](../../code/baseline-phases.md).
diverged from the plan.
**Scope:** How the WHEN→DO logic system detects triggers, sequences timed DO actions, and
resets/restarts at runtime.

## Purpose

This records the runtime-architecture considerations for the WHEN→DO logic system so the next
agent/session doesn't have to re-derive them, and gives a constrained implementation path for
when Stage 7 unblocks. The full design and rationale live in
[2026-09-17--DESIGN--when-do-runtime-architecture.md](2026-09-17--DESIGN--when-do-runtime-architecture.md)
— read that first. This handoff is the "what to do next" companion to that "what and why" doc.

The governing decision, in one line: **event-driven core, poll only where the browser gives no
event (spatial/zone conditions), and always edge-trigger the poll before it reaches `dispatch()`.**
DO-side timing reuses the `CoroutineManager.cs` reference pattern (`docs/07-research-and-history/Scripting_Logic_Interactive System_ for when do/CoroutineManager.cs`)
ported to native JS generators, not a hand-rolled enumerator.

## Still blocked on

- **Phase 2 command-path slice** — per
  [2026-09-17--REASSESSMENT--after-object-manager-merge.md](2026-09-17--REASSESSMENT--after-object-manager-merge.md),
  `packages/interaction` remains a buildable-skeleton candidate only after Phase 2 merges. Do not
  scaffold it as real code before that lands.
- Check `SESSION.md`'s Stage readiness table before starting — Stage 7 ("wire WHEN→DO") is the
  gated one; Stages 4a–4c (including drafting `packages/interaction` types) are not blocked on
  Phase 2 by themselves, only on someone prioritizing them.

## Instructions for the next agent

### Step 1: Inspect before designing further

Read, in order:

- [2026-09-17--DESIGN--when-do-runtime-architecture.md](2026-09-17--DESIGN--when-do-runtime-architecture.md) — the architecture this handoff assumes.
- [2026-09-17--PLAN--infrastructure-skeleton-extended.md](2026-09-17--PLAN--infrastructure-skeleton-extended.md) — `RuntimeEvent`/`RuntimeState`/`DispatchResult`/`dispatch()` shapes.
- [2026-09-17--REASSESSMENT--after-object-manager-merge.md](2026-09-17--REASSESSMENT--after-object-manager-merge.md) — why this is paper-only for now.
- [`../../src/viewport/interactionController.ts`](../../src/viewport/interactionController.ts) — existing DOM listener pattern to reuse for Tier 1 input events.
- [`../../src/Viewport.tsx`](../../src/Viewport.tsx) — the `animate()` RAF loop that Tier 1's spatial polling, Tier 2's dispatch calls, and Tier 3's `ActionSequencer` tick must all hook into.

Confirm the Phase 2 command-path slice's actual merge status before writing any
`packages/interaction` code — do not assume it has landed just because time has passed.

### Step 2: Build in this order once unblocked

Do not implement these out of order — each depends on the previous one's shape being settled:

1. `RuntimeEvent` / `RuntimeState` / `InteractionRule` / `DispatchResult` types in
   `packages/interaction` (already speced in the extended plan doc).
2. The pure `dispatch(event, rules, project, state)` function — no I/O, testable against fixtures
   alone. Get this fully tested before touching event sources.
3. Tier 1 event sources, **input first**: wire click/hover/key through the existing
   `interactionController.ts` listener pattern into `RuntimeEvent`s. Zone/proximity polling
   (edge-triggered, inside `Viewport.tsx`'s `animate()`) comes after input events work, since it's
   the harder/newer piece.
4. Tier 3 `ActionSequencer`: `start`/`stop`/`isRunning`/`waitSeconds`, ticked once per RAF frame
   alongside the event-source poll. Build and test it standalone (feed it plain generators) before
   wiring real DO actions through it.
5. Edit-mode/play-mode gating flag, plumbed the same way `Viewport` already reads `interactive`
   via `dataRef` — do not invent a second state-passing mechanism.
6. `resetRuntime()` (stop sequencer, discard `RuntimeState`, dispose registered non-scene side
   effects, let `syncObjects()` reconcile the visual state) — wire it to both the "exit play mode"
   action and a "restart scene" action before considering this slice done.

### Step 3: Keep the boundaries the design doc assumes

- DO actions that mutate the 3D scene must do so **imperatively on the Three.js objects**, never
  through `commit()`/`CommandTimeline`. If an action needs to go through the authoring-engine
  instead, that's a deviation from this design — stop and reconcile with the design doc, don't
  silently diverge.
- Non-scene side effects (panels, audio) must self-register with whatever `resetRuntime()` walks
  to dispose them. An action executor that opens a side effect without registering it will leak
  across resets — this is the most likely bug class in this area.
- `ProjectData` must not be edited while a play/preview session is active — the reset design
  assumes it's stable for the whole session. If live authoring-during-play becomes a real
  requirement, that invalidates the "reconciliation gives visual reset for free" assumption in the
  design doc and needs a fresh design pass, not a patch.

### Step 4: Validate

Run from `VThere Spatial Experience Builder/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

`dispatch()` and `ActionSequencer` should each have standalone unit tests before any Viewport
wiring is attempted — both are designed to be testable in isolation specifically so this is
possible.

### Step 5: Update documentation

After implementation, update this handoff (or file a new dated one) with:

- the actual exported API for `dispatch`, event sources, and `ActionSequencer`;
- how mode gating was actually wired into `Viewport.tsx`;
- test counts and commands run;
- any place the implementation diverged from the design doc, and why.

## Deferred work

Intentionally out of scope for this handoff:

- Editor UI for authoring WHEN/DO rules (Inspector panels) — team-owned, not this design.
- Runtime UI for presenting DO actions (panel styling, audio UI) — team-owned.
- Actual trigger/action vocabulary beyond the placeholders already listed in the extended plan
  (click, sceneStart, zoneEnter, timer / showPanel, playAudio, navigateScene) — vocabulary is a
  separate design question from the dispatch/detection/sequencing vehicle this handoff covers.
- Spatial partitioning/perf optimization for zone polling — not needed until object counts make a
  naive per-frame AABB scan measurably expensive; don't pre-optimize.
- An in-editor "Preview" toggle UI — the mode-gating design leaves a seam for it, but building the
  toggle itself is separate work.

## Acceptance criteria

This slice is complete when:

- `dispatch()` is pure, has no I/O, and is unit-tested against fixtures independent of any event
  source.
- Click/hover/key events reach `dispatch()` through real listeners, not polling.
- Zone/proximity conditions are polled inside the existing RAF loop, edge-triggered (one event per
  transition, not one per frame).
- `ActionSequencer` runs generator-based actions ticked from the same RAF loop, with
  `start`/`stop`/`isRunning` behaving like the `CoroutineManager` reference API.
- Edit mode never runs Tiers 1–3; play mode runs all three.
- `resetRuntime()` is shared by both "exit to edit" and "restart scene," fully clears
  `RuntimeState` and the sequencer, and disposes registered non-scene side effects.
- No `packages/interaction` code assumes Phase 2 has merged if it hasn't — check before claiming
  this done.

---

## Implementation outcome (2026-09-18)

**Gate check first:** Phase 2's merge was verified by reading `packages/authoring-engine/src/index.ts`
directly (lines 57-59 re-export `commands/types`, `commands/transformCommands`,
`commands/commandService`; `executeCommand` is real) and confirming `573def4` and `c027666` on the
branch — not inferred from elapsed time, per Step 1's instruction.

### Exported API

From `@vthere/interaction` (single entry point; subpath imports do not resolve):

```ts
dispatch(event, rules, project, state) → { rulesMatched, actions, nextState }
createZoneTracker(zones) → { tick(occupants) → RuntimeEvent[], reset() }
createActionSequencer() → { start, stop, isRunning, stopAll, tick(delta), runningCount }
waitSeconds(seconds)                       // yieldable inside an action generator
createActionRegistry() → { register, has, execute }
createEffectRegistry() → { add, dispose, disposeAll, size }
resetRuntime(session, { restart, sceneId? }) → RuntimeState | null
createRuntimeState(sceneId) / cloneRuntimeState(state)
```

### How mode gating was wired

An explicit `runtimeMode?: 'edit' | 'play'` prop on `Viewport`, carried through the existing
`dataRef` (both the initialiser and the assignment), read inside `animate()`, and deliberately kept
out of the setup effect's dependency array so a mode flip never rebuilds the WebGL context.
`RuntimeView` passes `"play"` plus `rules`/`zones`; the editor passes nothing and defaults to
`'edit'`. `ViewportInteractionData` gained a `runtimeActive` flag so the input listeners skip their
extra picking entirely while authoring.

`resetRuntime()` is reached two ways: `ViewportHandle.restartRuntime()` (the new "Restart scene"
button) and the setup effect's cleanup, which covers "Exit simulation" via unmount.

### Divergences from the plan, and why

1. **`InteractionRule.objectId` is optional**, not required as
   `2026-09-17--PLAN--when-do-dispatch-engine.md` specified. A `sceneStart` rule names no object,
   and the backend column is already nullable (`object_id: Mapped[str | None]`). Requiring it
   frontend-side would have contradicted the persisted schema.
2. **`actions` is `ActionSpec[]`, not `string[]`.** A bare string cannot carry
   `showPanel(componentId)` or `playAudio(assetId)` arguments, which the same doc also requires.
   `ActionSpec` is `{ kind, params? }` — still vocabulary-free.
3. **`DispatchResult` fields renamed** from `eventsMatched`/`actionsExecuted` to
   `rulesMatched`/`actions`. The originals named a lie: dispatch takes one event and returns rules,
   and it executes nothing.
4. **Ordering honours `priority` first, then authoring order** as a stable tiebreak. The plan named
   authoring order as the guarantee, but `priority` exists in both the plan and the DB column, so
   both are honoured with authoring order breaking ties.
5. **`InteractionRule`/`ActionSpec` live in `@vthere/project`**, re-exported by
   `@vthere/interaction`, because rules are persisted data and two declarations would drift.
6. **A frame-budget guard was added to `ActionSequencer`** (1000 steps/frame). Satisfied waits chain
   within one frame so `waitSeconds(0)` resumes immediately; without a ceiling,
   `while (true) yield waitSeconds(0)` would hang the tab. Hitting it parks the sequence until the
   next frame rather than killing it.

### Bug found and fixed during the build

The first `tick()` implementation charged a yielded wait against the *next* frame's delta, so every
`waitSeconds` silently cost one extra frame and `waitSeconds(0)` never resolved in-frame. Three
tests caught it. Waits are now charged at the moment they are yielded.

### Tests and commands

60 new tests in `packages/interaction` (dispatcher 15, ActionSequencer 16, zoneTracker 10,
registry 10, resetRuntime 9), plus 11 new serializer cases for the rules/zones migration.

```
npm.cmd run typecheck   # clean
npm.cmd test            # 201 passed (27 files)
npm.cmd run build       # succeeds
```

### Schema change

`ProjectData.rules?: InteractionRule[]` and `SceneData.zones?: ZoneDefinition[]`, both optional and
backfilled to `[]`, so `schemaVersion` stays `1` — the same additive pattern as `parentId`.
`serializer.ts` validates rule/zone id uniqueness, action shape, and rejects orphaned object/zone
references.

### Still deferred

Rule/zone authoring UI, action executor implementations (the registry is empty — an unregistered
kind is a deliberate no-op), the in-editor Preview toggle, and zone spatial partitioning.
