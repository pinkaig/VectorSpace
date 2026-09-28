# 3D Viewport

**Baseline phase:** Stage 6 + 7 (asset and event wiring into the viewport). See [8-stage baseline overview](../baseline-phases.md).

## Contents

- [Overview](#overview)
- [Where to Find Things](#where-to-find-things)
- [Component structure](#component-structure)
- [Props and data](#props-and-data)
- [Three.js objects](#threejs-objects)
- [Render and synchronization flow](#render-and-synchronization-flow)
- [Pointer interaction](#pointer-interaction)
- [Runtime mode](#runtime-mode)
- [Lifecycle and cleanup](#lifecycle-and-cleanup)
- [Performance and risks](#performance-and-risks)
- [Testing](#testing)
- [Related files](#related-files)

## Overview

`Viewport` is the boundary between React application state and the Three.js rendering engine. React creates the mount element and owns project state. Three.js owns the scene graph, camera, WebGL canvas, raycaster, and animation loop.

This page explains the larger rendering system. Current file-level implementation notes are kept in [src/Viewport.tsx](../../src/Viewport.tsx), including its props, refs, scene resources, pointer handlers, and cleanup responsibilities.

Implementation: [src/Viewport.tsx](../../src/Viewport.tsx)

## Where to Find Things

Use this table as the first stop when changing viewport or rendering behaviour.

| Concern | Current owner | Change this when... |
|---|---|---|
| React viewport boundary and public props | [`src/Viewport.tsx`](../../src/Viewport.tsx) | The mount element, public callbacks, overlays, or React refs change |
| Three.js scene, renderer, animation loop, and cleanup | [`src/Viewport.tsx`](../../src/Viewport.tsx) | The renderer lifecycle changes; this remains the next major extraction target |
| Environment construction and GLB/procedural loading | [`src/environments.ts`](../../src/environments.ts) | Environment assets, loading, progress, or disposal change |
| Environment loading lifecycle and replacement | [`src/viewport/environmentController.ts`](../../src/viewport/environmentController.ts) | Async loading, cancellation, replacement, or disposal handoff changes |
| Environment loading UI | [`src/viewport/ViewportOverlay.tsx`](../../src/viewport/ViewportOverlay.tsx) | Loading, retry, and error presentation changes |
| Camera pose and walk movement | [`src/viewport/cameraController.ts`](../../src/viewport/cameraController.ts) | Camera pose capture, pose application, or walk movement changes |
| Pointer, drag, gizmo picking, and keyboard listener ownership | [`src/viewport/interactionController.ts`](../../src/viewport/interactionController.ts) | Selection, drag previews, gizmo hits, or one-command-on-release behaviour changes |
| Artefact geometry, materials, visibility, picking metadata, and disposal | [`src/viewport/syncArtefacts.ts`](../../src/viewport/syncArtefacts.ts) | Artefact reconstruction or resource ownership changes |
| Gizmo visibility, placement, local/world orientation, and sizing | [`src/viewport/syncGizmo.ts`](../../src/viewport/syncGizmo.ts) | Gizmo presentation follows different object or transform rules |
| Gizmo handle assembly and disposal | [`src/viewport/createGizmoSet.ts`](../../src/viewport/createGizmoSet.ts) | Handle sets, gizmo resource ownership, or editor gizmo composition changes |
| Axis and rotation calculations | [`src/viewport/interactionMath.ts`](../../src/viewport/interactionMath.ts) | Ray/axis or angle behaviour changes; keep this framework-free |
| Three.js compatibility wrappers for gizmo math | [`src/gizmo/math.ts`](../../src/gizmo/math.ts) | Three.js vectors need adapting to the pure math contract |
| Gizmo geometry and colours | [`src/gizmo/`](../../src/gizmo/) | Handle meshes, dimensions, colours, or material behaviour change |
| Keyboard movement constants and input helpers | [`src/viewport/viewportTypes.ts`](../../src/viewport/viewportTypes.ts) | Walk controls, speeds, key mappings, or asset colours change |
| Asset Manager resolver composition and resolution status store | [`src/viewport/assetResolution.ts`](../../src/viewport/assetResolution.ts) | Which resolver an assetId routes through, or how status is cached/observed, changes — see [`asset-manager.md`](asset-manager.md) |
| Asset resolution status UI (loading/error badge, retry) | [`src/viewport/AssetStatusBadge.tsx`](../../src/viewport/AssetStatusBadge.tsx) | Loading/error presentation for the selected object's asset changes |
| Authoritative project objects and transforms | [`packages/project/src/index.ts`](../../packages/project/src/index.ts) | Persisted object shape or defaults change |
| Authoring commands and history | [`packages/authoring-engine/src/index.ts`](../../packages/authoring-engine/src/index.ts) | An edit must be immutable, undoable, or shared by editor controls |
| Editor composition | [`src/App.tsx`](../../src/App.tsx) | UI state dispatches commands or selects a scene |
| Visitor composition boundary | [`apps/runtime/src/RuntimeApplication.tsx`](../../apps/runtime/src/RuntimeApplication.tsx) | Runtime becomes independent from the transitional root view |

### Ownership rule

The project snapshot is authoritative. Three.js objects, gizmos, raycasters,
and renderer caches are disposable projections. A rendering module may read
project data and report input events, but it must not become the owner of
project mutations, persistence, or undo/redo.

### Next extraction targets

The remaining large responsibilities in `Viewport.tsx` are intentionally kept
together for now:

1. `createViewportRuntime`: scene, renderer, camera, animation loop, listeners,
   and cleanup.

`environmentController` is already extracted and owns asynchronous environment
replacement, cancellation, status reporting, and disposal handoff.
`cameraController` is also extracted and owns camera pose conversion and walk
movement; orbit/walk mode transition wiring remains in `Viewport.tsx`.
`interactionController` is extracted and is the sole owner of pointer, drag,
gizmo-picking, and keyboard listeners.

Extract these only when each module can own its resources and receive a narrow
contract. Do not split them merely to reduce the line count of `Viewport.tsx`.

```text
React App state
  -> Viewport props
  -> Three.js scene objects
  -> WebGL canvas
```

## Component structure

```text
Viewport (forwardRef<ViewportHandle, ViewportProps>)
├── mountRef: HTMLDivElement reference
├── dataRef: latest React props/callbacks (objects, selection, gizmo/camera mode,
│   runtimeMode, rules, zones, sceneId, ...) — read fresh every animation frame
├── THREE.Scene, PerspectiveCamera + OrthographicCamera (projection toggle)
├── WebGLRenderer (pixel ratio capped at 2)
├── Raycaster + Vector2 pointer coordinates
├── objectsGroup (authored artefacts) + environmentGroup + gizmoGroup (kept separate
│   so artefact rebuilds never dispose gizmo handles)
├── HemisphereLight, DirectionalLight, GridHelper
├── OrbitControls (orbit mode) / yaw-pitch refs (walk mode)
├── corner overlay widgets: OctaOrb + axis indicator, each rendered into a scissor
│   rect of the same canvas (no extra WebGL context)
├── WHEN→DO runtime (play mode only): ActionSequencer, EffectRegistry, ActionRegistry,
│   a zone tracker rebuilt when authored zones change, and RuntimeState
├── unpickableAssetIdsRef: object ids currently loading/erroring (see asset-manager.md)
├── ResizeObserver
├── createViewportInteractionController (owns all pointer/keyboard listeners)
└── requestAnimationFrame loop (animate): syncObjects -> syncGizmoFrame -> WHEN→DO
    tiers (play mode) -> camera update -> render -> overlay render
```

The current implementation has extracted artefact synchronisation, gizmo
synchronisation, pure interaction mathematics, environment loading, camera pose
handling, pointer/keyboard interaction, and overlay presentation into the
`src/viewport/` (and `src/gizmo/`) modules listed above. The renderer setup, the
WHEN→DO tier-1/tier-3 wiring, and the per-frame `animate()` loop itself still live
in `Viewport.tsx` until their ownership contracts are stable.

## Props and data

The real prop surface (`src/Viewport.tsx`) is much larger than the technical-spike shape this
section used to describe — it now carries gizmo mode/space, camera mode, environment/scene
identity, the WHEN→DO runtime mode plus rules/zones, and orthographic/overlay toggles:

```ts
interface ViewportProps {
  objects: SceneObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onScale?: (id: string, scale: [number, number, number]) => void
  onRotate?: (id: string, rotation: [number, number, number]) => void
  gizmoMode?: GizmoMode // 'select' | 'move' | 'rotate' | 'scale'; default 'select'
  scaleSpace?: 'world' | 'local'
  rotateSpace?: 'world' | 'local'
  sceneId?: string
  environmentId?: string
  startCamera?: CameraPose
  cameraMode?: CameraMode // 'orbit' | 'walk'; default 'orbit'
  resetToken?: number
  syncToken?: number // bumped when a rejected edit must force a rebuild from ProjectData
  interactive?: boolean // enables editor pointer handlers; runtime passes false
  runtimeMode?: 'edit' | 'play' // gates the WHEN→DO runtime; separate from `interactive`
  rules?: readonly InteractionRule[] // only read in play mode
  zones?: readonly ZoneDefinition[] // only read in play mode
  orthographic?: boolean
  onOrthographicChange?: (value: boolean) => void
  showOctaOrb?: boolean
  showAxisIndicator?: boolean
}

interface ViewportHandle {
  getCameraPose: () => CameraPose
  restartRuntime: () => void // tears down and restarts a live play session
}
```

`Viewport` is a `forwardRef<ViewportHandle, ViewportProps>` component; the handle lets a parent
(e.g. a "Restart scene" button) reach the live runtime imperatively without re-mounting the
WebGL context.

## Three.js objects

For each `SceneObject`, [`src/viewport/syncArtefacts.ts`](../../src/viewport/syncArtefacts.ts)
creates geometry keyed on `assetKind` (a box, sphere, or cylinder — the primitive shapes match
`AssetKind`'s current three values), plus visibility, hierarchy, and a selection outline:

```ts
const geometry = kind === 'sphere' ? new THREE.SphereGeometry(0.65, 32, 20)
  : kind === 'cylinder' ? new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32)
  : new THREE.BoxGeometry(1.1, 1.1, 1.1)
const material = new THREE.MeshStandardMaterial({ color: colorFor(item.assetKind), roughness: 0.68, metalness: 0.05 })
const mesh = new THREE.Mesh(geometry, material)

mesh.name = item.id
mesh.visible = item.visible
mesh.userData.entityId = item.id
mesh.userData.enabled = item.enabled
mesh.position.set(...item.transform.position)
mesh.rotation.set(...item.transform.rotation)
mesh.scale.set(...item.transform.scale)

if (item.id === selectedId) {
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xf3d48b })))
}
```

**Status on this branch: implemented.** Meshes nest under their parent mesh
following `parentId`, and `transform` is local-space for any parented object,
world-space for a top-level one — the two-pass build described below is the
live code. See
[`DEFERRED--parent-child-rendering.md`](DEFERRED--parent-child-rendering.md)
for the completed work log and verification checklist.

Meshes are built in two passes: every mesh is created first, then attached to its parent mesh (or
the root `objectsGroup`) in a second pass, keyed by `SceneObject.parentId` — this is what lets
Three.js's own `Object3D` hierarchy compose world transforms for nested objects (see the parent-child
slice 5 notes in [`authoring-engine.md`](authoring-engine.md)). `transform` on a parented object is
therefore local, not world, space.

The serialized object is the source of truth. The mesh is a temporary, disposable renderer
representation — `disposeObjectResources` (also exported from `syncArtefacts.ts`) walks the group
and disposes every mesh's geometry and material(s) before a rebuild.

Geometry does **not** yet vary by a resolved `AssetDescriptor`'s actual content (GLB, image,
etc.) — every object still renders as one of the three hardcoded primitive shapes regardless of
what the Asset Manager resolves. See [`asset-manager.md`](asset-manager.md)'s Limits section.

## Render and synchronization flow

```text
React project changes
  -> App passes new objects or selectedId
  -> dataRef receives latest values
  -> animation loop calls syncObjects()
  -> signature is compared with previous render
  -> object meshes are rebuilt when the signature changes
  -> renderer.render(scene, camera)
```

The signature check avoids rebuilding meshes when the project data has not changed.

The current prototype rebuilds all scene meshes when a relevant signature changes. A future optimization could update existing meshes by ID, but that should be measured before being introduced.

## Pointer interaction

All pointer, drag, gizmo-picking, and keyboard listeners are owned by
[`src/viewport/interactionController.ts`](../../src/viewport/interactionController.ts)'s
`createViewportInteractionController`, not by `Viewport.tsx` directly. It is constructed once per
renderer lifecycle with the scene's camera/controls/raycaster/pointer, the objects and gizmo
groups, an `interactive` flag, and a `callbacks` object (`getData`, `select`, `commitMove`,
`commitScale`, `commitRotate`, camera-orientation callbacks, and `onRuntimeEvent` for WHEN→DO
Tier 1 input — see [`when-do-dispatch-engine.md`](when-do-dispatch-engine.md)).

### Selection

```text
pointerdown
  -> calculate canvas-relative coordinates
  -> convert to normalized device coordinates
  -> raycaster.setFromCamera(pointer, camera)
  -> pick() traverses objectsGroup (meshes may be nested under a parent mesh),
     skipping loading/error assets (unpickableAssetIds — see
     asset-manager.md) and gizmo handles separately
  -> call onSelect(object.id) / callbacks.select(id)
```

### Movement, rotation, and scale

Transform manipulation goes through the gizmo, not a free floor-plane drag: `createGizmoSet`
([`src/viewport/createGizmoSet.ts`](../../src/viewport/createGizmoSet.ts)) builds move/rotate/scale
handle sets; `syncGizmo` ([`src/viewport/syncGizmo.ts`](../../src/viewport/syncGizmo.ts)) positions
and orients them each frame for the selected object; `interactionController.ts` hit-tests handles
and resolves axis/plane constraints via
[`src/viewport/interactionMath.ts`](../../src/viewport/interactionMath.ts) (framework-free) and
[`src/gizmo/math.ts`](../../src/gizmo/math.ts) (Three.js adapters over that pure math).

A drag previews renderer-side state on every `pointermove`, but commits exactly once — on
`pointerup` — by calling `callbacks.commitMove` / `commitScale` / `commitRotate`, which
`Viewport.tsx` wires to `dataRef.current.onMove` / `onScale` / `onRotate`. `App.tsx` routes those
into `executeCommand` against the authoring engine's transform commands (see
[`authoring-engine.md`](authoring-engine.md)'s "The transform command path"), so one pointer
gesture produces exactly one undo entry, never one per `pointermove` event.

For a parented object, a drag's result is world-space math (rays and planes are inherently
world-space) converted back to parent-local space via `Object3D.worldToLocal` / a
parent-quaternion inverse (`toLocalPosition` / `toLocalQuaternion` in `interactionController.ts`)
before it is committed — see the slice 5 notes in [`authoring-engine.md`](authoring-engine.md).
For a top-level object this conversion is the identity, so drag behavior there is unchanged.

## Runtime mode

[`src/RuntimeView.tsx`](../../src/RuntimeView.tsx) reuses the same `Viewport` component with
editing disabled and the WHEN→DO runtime turned on:

```tsx
<Viewport
  ref={viewportRef}
  objects={scene.objects}
  selectedId={null}
  onSelect={() => undefined}
  onMove={() => undefined}
  sceneId={scene.id}
  environmentId={scene.environmentId}
  startCamera={scene.startCamera}
  cameraMode="walk"
  interactive={false}
  runtimeMode="play"
  rules={project.rules ?? []}
  zones={scene.zones ?? []}
/>
```

Runtime still uses Three.js for 3D rendering; React renders the surrounding visitor chrome
(top bar, "Restart scene" / "Exit simulation" buttons, both driven through the `ViewportHandle`
ref's `restartRuntime()` and through unmounting, respectively — see
[`when-do-dispatch-engine.md`](when-do-dispatch-engine.md) for what each teardown does).
`interactive={false}` prevents editor pointer/gizmo handlers from being registered;
`runtimeMode="play"` is the separate flag that turns on WHEN→DO dispatch — the two are
deliberately independent so a future in-editor Preview can run rules with gizmo interactivity
still off.

## Usage

`Viewport` is a default export; editor and runtime call sites both import it the same way and
differ only in the props they pass:

```tsx
import Viewport, { type ViewportHandle, type CameraMode, type GizmoMode } from './Viewport' // from src/

// Editor (src/App.tsx): interactive, edit mode, no rules/zones read
<Viewport
  objects={scene.objects}
  selectedId={selectedId}
  onSelect={setSelectedId}
  onMove={(id, position) => { /* routes into executeCommand — see authoring-engine.md */ }}
  onScale={(id, scale) => { /* ... */ }}
  onRotate={(id, rotation) => { /* ... */ }}
  gizmoMode={gizmoMode}
  sceneId={scene.id}
  environmentId={scene.environmentId}
  startCamera={scene.startCamera}
  cameraMode={cameraMode}
  interactive
  runtimeMode="edit"
/>

// Runtime (src/RuntimeView.tsx): non-interactive, play mode, rules/zones live
// — see the exact call in "Runtime mode" below.
```

`ViewportHandle` (via `ref`) exposes `getCameraPose()` and `restartRuntime()` for a parent that
needs to reach the live Three.js/runtime state imperatively without re-rendering props.

## Lifecycle and cleanup

The `useEffect` block creates external resources after the mount element exists:

- Three.js scene and renderer
- Canvas element
- Pointer event listeners
- Resize observer
- Animation frame

The cleanup function must release them:

```ts
return () => {
  cancelAnimationFrame(frame)
  observer.disconnect()
  renderer.dispose()
  mount.removeChild(renderer.domElement)
}
```

Without cleanup, repeatedly entering runtime mode can create duplicate canvases, active listeners, animation loops, and GPU memory leaks.

## Performance and risks

Important risks include:

- Rebuilding all meshes for every meaningful data signature change
- Geometry and material disposal mistakes
- High device-pixel-ratio rendering cost
- WebGL availability on older devices
- Resize handling for narrow screens
- Raycast cost as the object count grows
- Selecting/interacting with an object whose asset is still loading or failed to resolve —
  handled since Stage 6: `interactionController.ts::pick` excludes objects tracked as
  loading/error in `Viewport.tsx`'s `unpickableAssetIdsRef`, so a click can't select or drag
  a mesh with no confirmed asset. Gizmo picking is unaffected, since gizmo handles are
  separate Three.js objects, not asset-resolved `SceneObject`s.

The current renderer caps pixel ratio at `2` to limit excessive GPU work on high-density displays.

## Testing

The viewport should be tested at two levels:

### Unit-level logic

Keep transform and ray/plane mathematics in framework-independent modules. Test with deterministic vectors, rays, and expected positions.

### Browser smoke tests

A browser test should confirm:

1. The application loads.
2. An object can be added.
3. A canvas is created.
4. Runtime mode displays the canvas.
5. Runtime mode does not expose editor movement controls.
6. Exiting runtime returns to the editor.

A canvas visibility check is useful, but it should also have a non-zero bounding box so a blank or collapsed canvas does not pass accidentally.

## Related files

- [Editor coordinator](../../src/App.tsx)
- [Runtime view](../../src/RuntimeView.tsx)
- [Project model](../../packages/project/src/index.ts)
- [Authoring engine contract](authoring-engine.md)
- [Technology stack](../architecture/UNDATED--FOUNDATION--tech-stack.md)

## Change history

| Date | Change |
|---|---|
| 2026-09-13 | Expanded documentation with component structure, data flow, pointer flow, lifecycle, and performance notes. |
| 2026-09-17 | Stage 6: wired the Asset Manager into selection and raycasting; documented `assetResolution.ts`, `AssetStatusBadge.tsx`, and the loading/error picking exclusion. |
| 2026-09-20 | Corrected props, mesh construction, pointer/gizmo interaction, component structure, and runtime-mode sections to match the actual Stage 6/7 implementation (gizmo-based transforms, WHEN→DO runtime wiring, full prop surface); added a Usage section; fixed links after docs restructure. |
