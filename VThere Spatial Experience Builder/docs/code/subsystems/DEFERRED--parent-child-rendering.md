# Deferred: parent-child rendering in the viewport

**Status:** schema landed, renderer deferred
**Owner:** unassigned
**Source of the finished code:** branch `Full-Skeleton-ver-2-Industry-Project-5---Spatial-Experience-Builder` ("FS")

## What this document is

When the baseline skeleton (FS) was migrated onto the `Working` line, one feature was deliberately left half-applied: **parent-child object hierarchy**. The data model went in; the renderer did not.

This file records exactly what was skipped, why it was safe to skip, and what to do to finish it. The code already exists and is already reviewed on FS — this is a port, not a design task.

## Current state

### What works today

`parentId` is a real, persisted field. All of this is live:

- `SceneObject.parentId?: string` in `packages/project/src/index.ts`
- `reparentObject()` in `packages/authoring-engine/src/index.ts` — with self-parent and cycle rejection, and world-pose preservation via `localTransformForNewParent()`
- `collectSubtreeIds()` in `packages/authoring-engine/src/objectAccess.ts` — so `removeObject` deletes a whole subtree and `duplicateObject` copies one with remapped ids
- `composeWorldTransform()` / `localTransformForNewParent()` in `packages/authoring-engine/src/transformMath.ts` — renderer-free TRS composition
- `validateSceneHierarchy()` in `src/serializer.ts` — rejects a missing parent, a self-parent, or a cycle at load
- `buildSceneTree()` / `previousSibling()` / `grandparentId()` in `src/editor/sceneTree.ts`
- The Inspector's **Parent** dropdown and the scene tree's **⇤ / ⇥** indent buttons in `src/App.tsx`

Setting a parent writes correct data, persists across save/reload, and round-trips through undo/redo.

### What does not work

**The viewport renders flat.** Every mesh is added directly to `objectsGroup`, so a child does not move, rotate or scale with its parent on screen.

One consequence is user-visible and worth knowing about: the Inspector labels transform fields `(local)` when an object has a parent — but because nothing nests, those numbers are still effectively world values. **The label is currently lying.** It stops lying the moment step 1 below lands.

## Why it was safe to defer

`Working` renders a flat scene graph: every mesh is a direct child of `objectsGroup`. Each renderer change on FS therefore degrades to a no-op while the graph stays flat:

| FS change | Why it is a no-op while flat |
|---|---|
| `syncArtefacts` two-pass nesting | With no `parentId` honoured, every mesh already attaches to `objectsGroup`. |
| `syncGizmo` `getWorldPosition()` | Equals `transform.position` exactly when the parent *is* `objectsGroup`. |
| `pick()` using `traverse()` | Equivalent to `children.filter` when nothing is nested. |
| `toLocalPosition` / `toLocalQuaternion` | Identity transforms with no intermediate parent. |

Skipping them cost only the visual nesting — no correctness, no data loss. It also kept `src/gizmo/**` and every camera/render file byte-identical to `Working`, which was the explicit constraint on that migration.

## The work

Four changes, in this order. Steps 1–3 are mechanical ports from FS; step 4 is verification.

### 1. `src/viewport/syncArtefacts.ts` — nest the meshes (+13 / −1)

Split the single build loop into two passes: create every mesh into a `Map<string, THREE.Mesh>` first, then attach each one to its parent mesh.

```ts
const meshesById = new Map<string, THREE.Mesh>()
objects.forEach((item) => { /* ...unchanged mesh construction... */ meshesById.set(item.id, mesh) })

objects.forEach((item) => {
  const mesh = meshesById.get(item.id)!
  const parentMesh = item.parentId ? meshesById.get(item.parentId) : undefined
  ;(parentMesh ?? group).add(mesh)
})
```

Two passes rather than one because attachment must not depend on the order of the `objects` array — a child may appear before its parent.

Nothing else in the file changes: geometry, material, selection outline and disposal all stay as they are. This one change is what makes Three.js compose world transforms through the `Object3D` hierarchy, which is the entire mechanism.

**After this step, `item.transform` becomes a *local* transform for any parented object.** Steps 2 and 3 exist only to keep the gizmo and drag math correct under that new meaning.

### 2. `src/viewport/syncGizmo.ts` — place the gizmo in world space (+4 / −1)

```ts
- gizmoGroup.position.set(...selected.transform.position)
+ gizmoGroup.position.copy(selectedMesh.getWorldPosition(new THREE.Vector3()))
```

Without this the gizmo renders at a child's *local* coordinates — i.e. the wrong place on screen. Behaviour for top-level objects is unchanged, since `getWorldPosition()` returns exactly `transform.position` when the parent is `objectsGroup`.

No other line in the file changes; arrow offsets, ring sizing and local/world orientation all stay.

### 3. `src/viewport/interactionController.ts` — world ↔ local conversion

The largest piece, and the only one needing care. Port these, all present on FS:

**a. Picking must traverse.** Nested meshes are no longer direct children of `objectsGroup`. The current code filters `objectsGroup.children` and carries a `NOTE:` comment pointing at this document — replace that whole block with:

```ts
const pickable: THREE.Object3D[] = []
objectsGroup.traverse((child) => {
  if (child instanceof THREE.Mesh && child.userData.entityId && child.visible &&
      child.userData.enabled !== false && !unpickableAssetIds.has(child.userData.entityId)) {
    pickable.push(child)
  }
})
```

Keep the existing `unpickableAssetIds` check — it already migrated with the asset manager and must survive this rewrite.

**b. Add the four conversion helpers.**

```ts
const worldPositionOf   = (mesh) => mesh.getWorldPosition(new THREE.Vector3())
const worldQuaternionOf = (mesh) => mesh.getWorldQuaternion(new THREE.Quaternion())
const toLocalPosition   = (mesh, world) =>
  mesh.parent && mesh.parent !== objectsGroup ? mesh.parent.worldToLocal(world.clone()) : world.clone()
const toLocalQuaternion = (mesh, world) => {
  if (!mesh.parent || mesh.parent === objectsGroup) return world.clone()
  return mesh.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)
}
```

The reason all of this is needed: **rays and planes are inherently world-space**, so drag math must run in world space and then be converted back to local before being written to the mesh or committed to the project.

**c. Grab-time origins and axes become world-space.** In `onPointerDown`, resolve `selectedMesh` first, then:
- gizmo origin: `new THREE.Vector3(...selected.transform.position)` → `worldPositionOf(selectedMesh)`
- scale direction (local space): `applyEuler(new THREE.Euler(...selected.transform.rotation))` → `applyQuaternion(worldQuaternionOf(selectedMesh))`
- rotate normal (local space): same `applyEuler` → `applyQuaternion` swap
- rotate seed: `currentQuaternion` seeds from `worldQuaternionOf(selectedMesh)` instead of the object's Euler
- free-drag origin: `worldPositionOf(hit)`
- scale start: read from `selectedMesh.scale` (this also removes a now-redundant `objectsGroup.getObjectByName` lookup)

**d. Drag handlers convert before writing.** In `onPointerMove`, for axis drag, free drag and local rotation — write *local* to the mesh, keep the gizmo in *world*:

```ts
const local = toLocalPosition(mesh, next)
lastAxisDragPosition = [local.x, local.y, local.z]
mesh.position.copy(local)
gizmoGroup.position.copy(next)      // world
```

Local rotation follows the same shape: `currentQuaternion` accumulates in world space, then `toLocalQuaternion(...)` before `mesh.quaternion.copy(...)` and before deriving the Euler that gets committed.

World-space rotation (the `else` branch) is unchanged.

### 4. Remove the deferral note and re-verify

Delete the `NOTE:` comment in `pick()` that points at this document, and mark this file resolved.

**No schema migration is required** — the persisted data is already correct and already validated. Existing projects with `parentId` set will simply start rendering nested.

## Retrieving the finished code

```bash
FS=Full-Skeleton-ver-2-Industry-Project-5---Spatial-Experience-Builder

# Steps 1 and 2 — take wholesale, they contain nothing else
git checkout $FS -- "VThere Spatial Experience Builder/src/viewport/syncArtefacts.ts"
git checkout $FS -- "VThere Spatial Experience Builder/src/viewport/syncGizmo.ts"

# Step 3 — review as a diff and hand-apply; do NOT take the whole file
git diff HEAD $FS -- "VThere Spatial Experience Builder/src/viewport/interactionController.ts"
```

`interactionController.ts` must be hand-applied because FS's version of the file also carries the WHEN→DO Tier 1 event emission, which is **already migrated**. Taking it wholesale risks reverting or duplicating that work. Apply only the world/local hunks described in step 3.

## Verification

**Automated**

- `npx tsc --noEmit`
- `npx vitest run` — `packages/authoring-engine/src/transformMath.test.ts` already covers `composeWorldTransform` and `localTransformForNewParent`; `src/serializer.test.ts` covers hierarchy validation. Both already pass before this work and must still pass after.
- `npm run test:e2e`

**Manual — regression (must be unchanged from before this work)**

1. Move / rotate / scale a **top-level** object with each gizmo, in both world and local space. Must feel identical — this is the main risk of step 3.
2. OctaOrb: click each face, nudge, roll, Home. Axis indicator renders bottom-left.
3. Orbit ↔ walk toggle; WASD, Space/C, Shift-sprint. Quad layout and the orthographic toggle.
4. Click-select and Esc-to-clear, in both orbit and walk mode.

**Manual — the new behaviour**

5. Parent object B to object A. B keeps its on-screen pose at the moment of parenting (that is `localTransformForNewParent` doing its job).
6. Move / rotate / scale A → B follows.
7. Select B: the gizmo sits on B's **world** position, and dragging B behaves correctly along each axis.
8. Scale A non-uniformly, then drag B — B's local position must still resolve correctly under the parent's scale.
9. Inspector on B now reads `Position (local)` and the numbers are genuinely parent-relative.
10. Delete A → B is deleted with it. Duplicate A → the whole subtree is copied with fresh ids.
11. Undo / redo across a reparent, a subtree delete and a subtree duplicate.
12. Save, reload, confirm the hierarchy renders nested from persisted data.

**Constraint check** — this work intentionally touches `syncGizmo.ts` and `syncArtefacts.ts`, which the original migration held byte-identical to `Working`. That is expected here. These must **still** be untouched afterwards:

```bash
git diff Working HEAD -- "VThere Spatial Experience Builder/src/gizmo"
git diff Working HEAD -- "VThere Spatial Experience Builder/src/viewport/cameraController.ts"
git diff Working HEAD -- "VThere Spatial Experience Builder/src/viewport/environmentController.ts"
git diff Working HEAD -- "VThere Spatial Experience Builder/src/viewport/createGizmoSet.ts"
git diff Working HEAD -- "VThere Spatial Experience Builder/src/viewport/overlayWidgets.ts"
```

All five must return empty.

## Risk notes

- **Step 3 is where a regression would hide.** The world/local conversions are identity operations for top-level objects, so a mistake there is invisible in a flat scene and only shows up once something is parented — or, worse, shows up subtly in existing flat-scene gizmo drags. Regression checks 1–4 above are the guard; run them before testing any of the new behaviour.
- **Deep hierarchies are untested.** `composeWorldTransform` walks the chain from the root down and is correct by construction, but nothing in the current test suite or UI exercises more than two levels.
- **Non-uniform parent scale** composes per-axis without shear (check 8). This matches the `Object3D` model and the `@boundary` note in `transformMath.ts`, but it is the case most likely to surprise.
- `transformMath.ts` deliberately has **no `three` dependency** — it reimplements XYZ-order Euler↔quaternion conversion to match `THREE.Euler`. If Three.js's default Euler order ever changes, these two must be changed together.
