# Design: WHEN→DO Runtime Architecture (Detection, Sequencing, Reset)

**Date:** 2026-09-17
**Context:** [2026-09-17--PLAN--infrastructure-skeleton-extended.md](2026-09-17--PLAN--infrastructure-skeleton-extended.md)
and [2026-09-17--REASSESSMENT--after-object-manager-merge.md](2026-09-17--REASSESSMENT--after-object-manager-merge.md)
already approved the pure `dispatch(event, rules, project, state)` core and the `RuntimeEvent` /
`RuntimeState` / `InteractionRule` shapes as **paper design**. This doc answers the question those
left open: how are triggers actually *detected* at runtime, how does timed/sequenced DO behavior
work, and how does a run start over cleanly — without turning the dispatcher into a per-frame
polling engine or losing the responsiveness a web UI needs.

**Status: paper design only, no code.** Still gated on the Phase 2 command-path merge per the
Reassessment doc's sequencing. This is written to be concrete enough to inform the
`InteractionRule` / `RuntimeEvent` / `RuntimeState` schema once Stage 7 unblocks.

## Reference material

[`Scripting_Logic_Interactive System_ for when do/`](Scripting_Logic_Interactive%20System_%20for%20when%20do/)
holds prior-art from an earlier DigiPen engine project (CtrlAlt): `SLogic` (a C++ ECS system that
ticks every scripted entity's `Update()`/`FixedUpdate()` every frame, with ad hoc button-flag
checks bolted on) and `CoroutineManager.cs` (a hand-rolled `IEnumerator`-based scheduler ticked
once per frame, used in `Eze_DialogueScene.cs` to sequence dialogue/fades). Useful shape, but two
things don't carry over directly: everything in `SLogic` is polled every frame including plain
button clicks (wasteful in a browser, where real click events exist), and `CoroutineManager`
worked around Mono/`DateTime` limitations that don't apply in JS.

## Recommendation: hybrid, three tiers

Pure per-frame polling and pure event-listening don't work in isolation here. Browsers give real
events for input (click/hover/key) but nothing for spatial/state conditions (zone entry,
proximity) — those must be checked, but the checking can still be edge-triggered so the rest of
the system stays event-shaped and the dispatcher never has to run "every frame."

### Tier 1 — WHEN detection (event sources, pluggable, mixed strategy)

- **Discrete input** (click, hover, key) → real DOM listeners, reusing the existing pattern in
  [`interactionController.ts`](../../src/viewport/interactionController.ts)
  (`pointerdown`/`pointerup`/`keydown`, etc.). No polling, fully responsive.
- **Lifecycle triggers** (sceneStart/sceneEnd) → fired explicitly by scene-transition code, not
  polled.
- **Spatial/continuous conditions** (zoneEnter/zoneExit, proximity) → no native browser event
  exists for these, so they're checked once per frame inside the render loop already running in
  [`Viewport.tsx`](../../src/Viewport.tsx) (`animate()`, alongside `syncObjects`/`syncGizmoFrame`)
  — cheap AABB/sphere overlap tests against live Three.js transforms, no new loop needed.
  Critically, this event source keeps a `Set<objectId>` of "currently inside zone X" per zone and
  diffs it frame-to-frame, only emitting a synthetic `zoneEnter`/`zoneExit` `RuntimeEvent` on the
  transition — not every frame. This is the same idea as the ad hoc `onClick`/`onReleased`
  flag-checks in the legacy `SLogic::Update` (`SLogic.cpp:123-136`), done with explicit edge
  detection instead of re-firing continuously.
- All sources — DOM-driven or poll-driven — normalize to the same `RuntimeEvent` shape and call
  the same `dispatch()` entry point. `InteractionRule` authors never know or care which mechanism
  detected the trigger.

### Tier 2 — dispatch stays exactly as already planned

`dispatch(event, rules, project, state) → DispatchResult` remains pure and synchronous, invoked
once per emitted event (not once per frame). No change to the existing plan — this just confirms
a polling-sourced event (zoneEnter) is fully compatible with an otherwise event-driven core.

### Tier 3 — DO execution: port `CoroutineManager.cs` as a TS generator-based `ActionSequencer`

- Instantaneous actions (`showPanel`, `navigateScene`) apply synchronously as soon as `dispatch()`
  returns.
- Actions needing duration/sequencing (fades, delays, typewriter-style dialogue like
  `Eze_DialogueScene.cs`) get wrapped as a JS generator (`function*`/`yield`) — a direct, native
  equivalent of the C#'s `IEnumerator`/`yield return`, without the workarounds the original needed
  (its custom `Time.time` in place of `DateTime.Now` was a Mono limitation that doesn't exist in
  JS).
- A small sequencer ticks all running generators once per RAF frame from the same `animate()`
  loop: `start(generatorFn) → handle`, `stop(handle)`, `isRunning(handle)`, plus a `waitSeconds(s)`
  yieldable gated on the loop's existing accumulated `delta`. This mirrors `CoroutineManager`'s
  `StartCoroutine`/`StopCoroutine`/`IsCoroutineRunning`/`Update()` API but idiomatically, and keeps
  the pure dispatcher itself free of timing/async concerns — still trivially unit-testable.

## Edit-mode vs. play-mode gating

`InteractionRule[]` is authored/saved as ordinary `ProjectData` regardless of mode — editing a
rule in the Inspector is a normal `commit()` through the authoring-engine/`CommandTimeline`,
undo/redo-safe for free. No change here.

Whether Tier 1/2/3 are *actively running* must be gated by an explicit mode flag, not by
`interactive={false}` (which today only toggles gizmo interactivity between `Viewport` and
`RuntimeView`). Recommendation:

- **Edit mode**: event sources/dispatcher do not run — moving/placing objects while authoring must
  never fire `zoneEnter`/`click` rules; `RuntimeState` doesn't need to exist.
- **Play/runtime mode** (`RuntimeView`, or a future in-editor "Preview" toggle): Tiers 1–3 all
  tick; `RuntimeState` is created fresh on entry and discarded on exit, never written back into
  `ProjectData`.
- This also gives a free seam for an in-editor "Preview" button later — just flipping the same
  mode flag `Viewport` already reads via `dataRef`, no architecture change needed.

## Reset & cleanup — leaving play mode, and restarting mid-run

Two situations need the same underlying reset, not two separate mechanisms:

- **Stopping play/preview and returning to edit mode** — all runtime side effects must be torn
  down so editing resumes from a clean slate.
- **User-initiated restart while still running** (e.g. a "restart scene" control during
  Play/RuntimeView) — same teardown, but immediately followed by starting a fresh run instead of
  returning to edit mode.

Design a single shared `resetRuntime()` used by both:

1. **Stop all Tier-3 sequencing** — clear every running action generator
   (`ActionSequencer.stopAll()`), directly analogous to `CoroutineManager.ClearCoroutines()` being
   called from `OnDestroy()` in the reference `Eze_DialogueScene.cs`. Nothing should keep
   animating/ticking across a reset.
2. **Discard `RuntimeState`** — drop `visitedZones`/`currentSceneId`/`runtimeData` entirely; a
   fresh one is created only when a new run starts. Never merge or carry state across a reset.
3. **Revert visual state "for free"** — because DO actions mutate the live Three.js scene
   imperatively and are deliberately kept **outside** `ProjectData`/`CommandTimeline` (Tier 3), the
   authoritative `ProjectData` was never touched during the run. Restoring the 3D scene is then
   just letting the normal `syncObjects()` reconciliation redraw from that untouched snapshot — no
   inverse-action bookkeeping needed for transforms/visibility/etc.
4. **Explicitly tear down non-scene side effects** — anything a DO action created outside the
   Three.js scene graph (an open panel overlay, a playing `<audio>` element) is *not* covered by
   step 3's reconciliation and needs its own cleanup. Action executors should register such side
   effects in a small "active effects" set that `resetRuntime()` walks and disposes (close panels,
   stop/dispose audio, etc.).
5. **Re-arm on restart only** — if this is a restart-in-place (not exit-to-edit), immediately
   create a fresh `RuntimeState`, resume ticking Tiers 1–3, and re-fire the `sceneStart` event so
   entry-triggered rules run again from the top.

This assumes authoring edits are disabled while a play/preview session is active, so the
`ProjectData` captured at play-start remains a stable, correct restore target for the whole
session — there's no separate snapshot to manage; the live, never-mutated `ProjectData` already
serves as the initial state.

## Summary of what this resolves

- Confirms the existing pure-`dispatch()` design is compatible with a poll-based event source, as
  long as polling stays inside the event-source layer and is edge-triggered before it ever reaches
  `dispatch()`.
- Gives DO-side timing/sequencing a concrete design (`ActionSequencer`), ported from
  `CoroutineManager.cs`'s proven shape but using native JS generators instead of a hand-rolled
  enumerator workaround.
- Answers the open `SESSION.md` question of where `RuntimeState`/dispatch ticking is invoked from:
  the existing `Viewport` RAF loop, gated by an edit/play mode flag — not a new standalone runtime
  loop.
- Adds the reset/cleanup model (`resetRuntime()`) needed for both "stop preview" and "restart
  scene," which the original vocabulary sketch didn't cover.

Still no code: `packages/interaction`, `ActionSequencer`, and the event-source modules remain
postponed until the Phase 2 command-path slice merges, per the Reassessment doc.
