# 3D Viewport

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
| Artefact geometry, materials, visibility, picking metadata, and disposal | [`src/viewport/syncArtefacts.ts`](../../src/viewport/syncArtefacts.ts) | Artefact reconstruction or resource ownership changes |
| Gizmo visibility, placement, local/world orientation, and sizing | [`src/viewport/syncGizmo.ts`](../../src/viewport/syncGizmo.ts) | Gizmo presentation follows different object or transform rules |
| Axis and rotation calculations | [`src/viewport/interactionMath.ts`](../../src/viewport/interactionMath.ts) | Ray/axis or angle behaviour changes; keep this framework-free |
| Three.js compatibility wrappers for gizmo math | [`src/gizmo/math.ts`](../../src/gizmo/math.ts) | Three.js vectors need adapting to the pure math contract |
| Gizmo geometry and colours | [`src/gizmo/`](../../src/gizmo/) | Handle meshes, dimensions, colours, or material behaviour change |
| Keyboard movement constants and input helpers | [`src/viewport/viewportTypes.ts`](../../src/viewport/viewportTypes.ts) | Walk controls, speeds, key mappings, or asset colours change |
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
2. `cameraController`: orbit/walk controls, camera poses, and keyboard motion.
3. `interactionController`: selection, free drag, axis drag, scale, rotation,
   and one-command-on-release commits.
4. `interactionController`: selection, free drag, axis drag, scale, rotation,
   and one-command-on-release commits.

`environmentController` is already extracted and owns asynchronous environment
replacement, cancellation, status reporting, and disposal handoff.

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
Viewport
├── mountRef: HTMLDivElement reference
├── dataRef: latest React callbacks and project data
├── THREE.Scene
├── PerspectiveCamera
├── WebGLRenderer
├── Raycaster
├── Vector2 pointer coordinates
├── Group scene objects
├── HemisphereLight
├── DirectionalLight
├── GridHelper
├── floor Mesh
├── ResizeObserver
├── pointer handlers
└── requestAnimationFrame loop
```

The current implementation has extracted artefact synchronisation, gizmo
synchronisation, pure interaction mathematics, and overlay presentation into
the `src/viewport/` modules listed above. The lifecycle and interaction state
machines still live in `Viewport.tsx` until their ownership contracts are
stable.

## Props and data

```ts
interface ViewportProps {
  objects: SceneObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  interactive?: boolean
}
```

| Prop | Meaning |
|---|---|
| `objects` | Scene objects to reconstruct as Three.js meshes. |
| `selectedId` | Object that should receive the selection outline. |
| `onSelect` | Callback from Three.js input back into React state. |
| `onMove` | Callback that commits a new position through the application coordinator. |
| `interactive` | Enables editor pointer handlers. Runtime passes `false`. |

## Three.js objects

For each `SceneObject`, the viewport creates:

```ts
const geometry = new THREE.BoxGeometry(1.1, 1.1, 1.1)
const material = new THREE.MeshStandardMaterial({
  color: colorFor(item.assetKind),
})
const mesh = new THREE.Mesh(geometry, material)

mesh.name = item.id
mesh.position.set(...item.transform.position)
mesh.rotation.set(...item.transform.rotation)
mesh.scale.set(...item.transform.scale)
```

The serialized object is the source of truth. The mesh is a temporary renderer representation.

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

### Selection

```text
pointerdown
  -> calculate canvas-relative coordinates
  -> convert to normalized device coordinates
  -> raycaster.setFromCamera(pointer, camera)
  -> intersect scene meshes
  -> call onSelect(object.id)
```

### Movement

The current prototype records the starting pointer position and object position. During `pointermove`, it computes a simple floor-plane delta and sends the new position through `onMove`.

```ts
const next: [number, number, number] = [
  startX + (event.clientX - startPointerX) * scale,
  currentY,
  startZ + (event.clientY - startPointerY) * scale,
]

onMove(objectId, next)
```

This is a technical-spike interaction, not yet a complete professional transform-gizmo system. The planned authoring engine will own axis constraints, snapping, rotation, scale, and command grouping.

## Runtime mode

`RuntimeView` reuses the viewport with editing disabled:

```tsx
<Viewport
  objects={scene.objects}
  selectedId={null}
  onSelect={() => undefined}
  onMove={() => undefined}
  interactive={false}
/>
```

Runtime still uses Three.js for 3D rendering. React renders the surrounding visitor UI. The `interactive` prop prevents editor pointer handlers from being registered.

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
- Rendering a scene while its assets are still loading in a future implementation

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
- [Technology stack](../02-architecture/UNDATED--FOUNDATION--tech-stack.md)

## Change history

| Date | Change |
|---|---|
| 2026-09-13 | Expanded documentation with component structure, data flow, pointer flow, lifecycle, and performance notes. |
