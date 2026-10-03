# Authoring Engine

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

## Purpose

Provide one standalone, custom-built TypeScript component that converts author input into correct, reversible project edits. This is the required DigiPen technical component.

## Boundary

```text
Three.js adapter / editor input
          |
          | camera rays, pointer samples, selection hits
          v
packages/authoring-engine
  hit testing -> constraint solving -> transform preview
  command creation -> command history -> checkpoint request
          |
          v
shared ProjectDocument + DraftPersistence adapter
```

## Where to Find Things

| Concern | Current owner |
|---|---|
| Canonical project and object shape | [`packages/project/src/index.ts`](../../packages/project/src/index.ts) |
| Immutable lifecycle and transform operations | [`packages/authoring-engine/src/index.ts`](../../packages/authoring-engine/src/index.ts) |
| Scene/object address resolution and failure reporting | [`packages/authoring-engine/src/objectAccess.ts`](../../packages/authoring-engine/src/objectAccess.ts) |
| Reversible command contract | [`packages/authoring-engine/src/commands/types.ts`](../../packages/authoring-engine/src/commands/types.ts) |
| Transform validity, application, and reversal | [`packages/authoring-engine/src/commands/transformCommands.ts`](../../packages/authoring-engine/src/commands/transformCommands.ts) |
| Whether an edit reaches history | [`packages/authoring-engine/src/commands/commandService.ts`](../../packages/authoring-engine/src/commands/commandService.ts) |
| Editor-specific operation policy and ID generation | [`src/editor/editorOperations.ts`](../../src/editor/editorOperations.ts) |
| Scene-tree render order, indent/outdent sibling lookup | [`src/editor/sceneTree.ts`](../../src/editor/sceneTree.ts) |
| World-transform composition for the parentId hierarchy | [`packages/authoring-engine/src/transformMath.ts`](../../packages/authoring-engine/src/transformMath.ts) |
| React project/session state and timeline coordination | [`src/App.tsx`](../../src/App.tsx) |
| Renderer pointer translation and commit callbacks | [`src/viewport/interactionController.ts`](../../src/viewport/interactionController.ts) |
| Mesh nesting per parentId, world-space rendering | [`src/viewport/syncArtefacts.ts`](../../src/viewport/syncArtefacts.ts) |

### The transform command path

A transform edit takes one route, whether it starts at a gizmo drag or an
Inspector field:

```text
gizmo drag release / inspector change
  -> editorOperations.*Command(sceneId, objectId, value)   // builder, not a command
  -> executeCommand(timeline, builder)
       builder(timeline.current)   -> resolve object, validate value, capture before
       command.isNoop?(current)    -> 'unchanged', no history entry
       command.execute(current)    -> new ProjectData snapshot
       timeline.commit(label, next)
  -> 'committed' | 'unchanged' | 'rejected'
```

Three properties this path guarantees, each covered by a test:

- **One user action, one history entry.** The viewport's pointer-move handlers
  write renderer-side preview state only; `interactionController.ts` calls the
  commit callback once, on pointer release.
- **An invalid transform creates no history entry.** Non-finite numbers and a
  zero or negative scale are rejected before a snapshot exists, mirroring the
  `isTuple` rule in `src/serializer.ts` so the project cannot reach a state that
  fails to load.
- **The undo value is captured from live timeline state.** `executeCommand`
  takes a builder rather than a finished command, so a stale React closure
  cannot record an entry that restores the wrong snapshot.

`Command.undo()` is implemented and tested as the true inverse of `execute()`,
but the timeline still restores whole snapshots. That is deliberate: snapshot
undo already covers create, duplicate, remove, and reparent. `undo()` is the
seam for a future command-stack timeline, not yet its driver.

### The scene-tree hierarchy panel (parent-child slice 4)

`parentId?: string` on `SceneObject` and `reparentObject`/subtree-aware
`removeObject`/`duplicateObject` (parent-child slices 1-2) had no UI until this
slice. The scene tree in the left rail now renders the hierarchy directly,
using `buildSceneTree` in `src/editor/sceneTree.ts` to turn the flat
`SceneObject[]` into a depth-first, depth-annotated row order — the same order
drives both the indentation shown and the sibling lookups the tree controls
need.

Reparenting has no drag-to-reparent (that was one of the two options the prior
session's handoff left open; the other, an indented tree list, is what this
slice implements) and instead goes through explicit controls:

- **Indent/outdent buttons** on each tree row move an object to the previous
  sibling (indent) or to its grandparent (outdent), via `previousSibling` and
  `grandparentId` in `sceneTree.ts`.
- **A Parent dropdown in the Inspector** picks an arbitrary parent. Its
  options exclude the selected object's own subtree
  (`collectSubtreeIds`, already exported for `removeObject`/`duplicateObject`)
  so the UI cannot offer a choice `reparentObject` would reject as a cycle.

Both paths call the same `reparentEditorObject` wrapper and commit through the
plain snapshot `commit()` used by delete/duplicate/rename — not the transform
`executeCommand` path above, since reparenting is a single discrete edit, not
a per-pointer-move drag. Deleting a parent removes its whole subtree from
`scene.objects` (already true since slices 1-2), so the tree simply stops
rendering the removed rows with no extra hierarchy-aware logic.

Transforms remain world-space: reparenting does not move a child to compensate
for its new parent's transform. That is slice 5, deliberately separate.

### Transform inheritance (parent-child slice 5)

**Status on this branch: implemented.** The `transformMath.ts` module,
`reparentObject`'s use of it, and the renderer half (mesh nesting in
`syncArtefacts.ts`, world-space gizmo placement in `syncGizmo.ts`, and the
`pick()`/drag conversion in `interactionController.ts`) were ported from
the baseline in full — see
[`CURRENT--parent-child-rendering.md`](CURRENT--parent-child-rendering.md)
for the completed work log and the verification checklist. The renderer nests
meshes under their parent mesh via `Object3D`, and `SceneObject.transform` is
local-space for any object with a `parentId`, world-space for a top-level
object.

Slice 4 rendered the hierarchy in the UI, but the renderer still added every
mesh flat into one `THREE.Group` and every transform math path (drag/gizmo
placement) assumed `SceneObject.transform` was a world-space value. This
slice makes local-space semantics real end to end.

**Decision: re-parenting recomputes the child's local transform to preserve
its current world position.** This matches the Unity-style behavior already
assumed for subtree removal/duplication in this codebase (parent-child slices
1-2), and it's what keeping an object visually in place during a re-parent
requires — the alternative (leave the local numbers untouched) would make
every re-parent onto a non-identity-transformed parent an implicit teleport.

- **`packages/authoring-engine/src/transformMath.ts`** is a framework-free
  (no `three` import) quaternion/vector module — `composeWorldTransform` walks
  an object's `parentId` chain to produce its world position/quaternion/scale,
  and `localTransformForNewParent` is its inverse: given a child's current
  world pose and a *new* parent's world pose, it produces the local
  `TransformData` that keeps the child's world pose fixed. `reparentObject`
  calls both around the existing cycle checks. This assumes standard
  TRS-per-node composition (no shear) — the same model Three.js's own
  `Object3D` hierarchy uses.
- **`src/viewport/syncArtefacts.ts`** builds every mesh first, then attaches
  each one to its parent's mesh (or the root group, if top-level) in a second
  pass, so Three.js's own scene graph composes world transforms — no manual
  matrix math in the project model or the renderer.
- **`src/viewport/interactionController.ts`** does the world-space math it
  always did (rays and planes are inherently world-space), but now reads a
  dragged object's world position/quaternion via `mesh.getWorldPosition` /
  `getWorldQuaternion` instead of trusting `transform.position` to be world
  space, and converts the result back to the mesh's parent-local space with
  `Object3D.worldToLocal` / a parent-quaternion inverse before writing
  `mesh.position`/`mesh.quaternion` or committing — the same Three.js APIs the
  renderer already relies on for hierarchy composition, applied at the
  boundary where a drag's result becomes a committed local value. `pick()`
  also switched from `objectsGroup.children` to a full `traverse`, since a
  parented mesh is no longer a direct child of the root group. Scale drags are
  unchanged: they already write the mesh's own local `scale`, which is
  already correct Unity-style behavior once nested (apparent world scale is
  `parentScale * localScale` automatically).
- **The Inspector** shows the same `SceneObject.transform` values as before —
  no conversion needed, since local and world are the same value for a
  top-level object — but now labels each field `(local)` or `(world)` based on
  whether the object has a `parentId`.

**Documented limitation:** non-uniform scale combined with rotation on a
parent can shear a child, same as it would in Three.js's own hierarchy or in
any TRS-per-node system; this slice does not attempt full matrix
decomposition to avoid that, since nothing in this app currently produces it.

### Why `editorOperations.ts` exists

At its current size, this file is intentionally close to the minimum useful
boundary. Most of its functions delegate directly to the authoring engine. The
delegation is not valuable because it shortens `App.tsx`; it is valuable only
if the editor needs policies that should not be placed in React components or
in the framework-free engine.

The current policy boundary has two concrete reasons:

1. **Browser identity:** object IDs are allocated with `crypto.randomUUID()` at
  the browser/application edge. The authoring engine accepts an injected ID
  factory and remains deterministic and testable without browser APIs.
2. **Editor vocabulary:** the editor can use names such as
  `createEditorObject` and `setEditorObjectVisible` without making the core
  operation API depend on React controls, inspector wording, or editor
  workflows.

The file should not be kept merely as a second copy of the engine API. If the
editor adds no policy beyond direct forwarding, it is reasonable to remove the
thin wrappers and import the engine operations directly. The ID factory could
then remain in a small application utility.

### Responsibilities that may move here later

Add a responsibility only when it is editor-specific and has tests. Suitable
future responsibilities include:

- translating an inspector draft into one compound authoring operation;
- applying editor defaults such as placement offsets or readable duplicate
  names;
- coordinating multi-step editor actions such as duplicate-and-select;
- choosing the editor's re-parenting policy, such as keep-world-transform;
- converting authoring failures into structured UI-facing outcomes;
- providing editor-only command labels and checkpoint metadata;
- supplying browser/application dependencies such as ID generators and clocks.

These are orchestration and policy concerns. The immutable state transition,
validation, hierarchy rules, transform math, and undo semantics must remain in
`packages/authoring-engine` or another framework-free package.

### Responsibilities that must not move here

Do not turn this file into an `ObjectManager` or a second command engine. It
must not own:

- a mutable project or object collection;
- undo/redo state;
- Three.js objects or renderer caches;
- persistence or autosave;
- hierarchy validation duplicated from the domain layer;
- transform mathematics duplicated from the authoring engine;
- runtime-only behaviour.

The decision rule is:

> Keep `editorOperations.ts` only while it removes editor policy from React or
> isolates an application dependency. Otherwise, prefer direct engine calls.

### Owns

- Selection state and selection hit results
- Translation, rotation, and scale manipulation sessions
- Screen-space gizmo handle hit testing
- Ray/axis/plane constraint solving
- Snapping policy and local/world transform mode
- Degenerate camera-angle handling
- Compound command creation
- Undo/redo timeline and redo invalidation
- Checkpoint boundaries emitted after committed edits

### Does not own

- React components or UI state
- Three.js scene objects or rendering materials
- HTTP, authentication, PostgreSQL, object storage, or analytics
- Autosave transport or storage providers
- Visitor runtime behaviour
- Asset downloads or model conversion

## Public API (as implemented)

`packages/authoring-engine` has a single entry point (`package.json`'s `"exports"` is
`./src/index.ts`; subpath imports such as `@vthere/authoring-engine/commands` do not resolve),
re-exporting everything below from `packages/authoring-engine/src/index.ts`.

The gizmo hit-testing, ray/plane constraint solving, and screen-space handle math described
earlier in "Owns" live in `src/gizmo/` and `src/viewport/interactionMath.ts` (framework-free,
documented in [`viewport.md`](CURRENT--viewport.md)), not inside this package — this package owns the
project-mutation side of an edit (commands, history, transform validity, hierarchy), not pointer
math or Three.js hit testing. The `AuthoringEngine` / `TransformManipulator` / `GizmoHitTest` /
`ConstraintSolver` / `CommandHistory` interface names that previously appeared in this section
were an early design sketch and do not exist in source; the real shape is the command timeline
and free functions below.

```ts
// Command timeline (packages/authoring-engine/src/index.ts)
export interface CommandTimeline<T> {
  readonly current: T
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly past: readonly HistoryEntry<T>[]
  readonly future: readonly HistoryEntry<T>[]
  commit(label: string, state: T): CommandTimeline<T>
  undo(): CommandTimeline<T>
  redo(): CommandTimeline<T>
}
export const createCommandTimeline: <T>(
  initialState: T,
  clone: (state: T) => T,
  limit?: number, // default 40
) => CommandTimeline<T>

// Object/scene operations — each clones the project and returns a new snapshot
export const createObject: (project, input: { sceneId, assetKind, name? }, idFactory) => ObjectOperationResult
export const duplicateObject: (project, input: ObjectTargetInput, idFactory) => ObjectOperationResult
export const removeObject: (project, input: ObjectTargetInput) => ObjectOperationResult
export const reparentObject: (project, input: { sceneId, objectId, parentId: string | null }) => ObjectOperationResult
export const updateObjectTransform: (project, input: ObjectTargetInput & { changes }) => ObjectOperationResult
export const renameObject: (project, input: ObjectTargetInput & { name }) => ObjectOperationResult
export const setObjectAssetId: (project, input: ObjectTargetInput & { assetId }) => ObjectOperationResult
export const setObjectVisible: (project, input: ObjectTargetInput & { value }) => ObjectOperationResult
export const setObjectEnabled: (project, input: ObjectTargetInput & { value }) => ObjectOperationResult
export const updateScene: (project, input: { sceneId }, changes) => ObjectOperationResult
export const createScene: (project, scene) => ObjectOperationResult
export const setActiveScene: (project, sceneId: string) => ObjectOperationResult

// Reversible transform commands (packages/authoring-engine/src/commands/transformCommands.ts)
export type Vector3Tuple = [number, number, number]
export const createMoveCommand: (project, target: ObjectTargetInput, position: Vector3Tuple) => ProjectCommand
export const createRotateCommand: (project, target: ObjectTargetInput, rotation: Vector3Tuple) => ProjectCommand
export const createScaleCommand: (project, target: ObjectTargetInput, scale: Vector3Tuple) => ProjectCommand

// The command contract (packages/authoring-engine/src/commands/types.ts)
export interface Command<T> {
  readonly label: string
  execute(project: T): T
  undo(project: T): T
  isNoop?(project: T): boolean
}
export type ProjectCommand = Command<ProjectData>
export type CommandStatus = 'committed' | 'unchanged' | 'rejected'

// Committing a built command against live timeline state
// (packages/authoring-engine/src/commands/commandService.ts)
export type ProjectCommandBuilder = (project: ProjectData) => ProjectCommand
export const executeCommand: (
  timeline: CommandTimeline<ProjectData>,
  build: ProjectCommandBuilder,
) => CommandExecutionResult // { status: CommandStatus; error?: Error }

// Object/scene address resolution (packages/authoring-engine/src/objectAccess.ts)
export class ObjectOperationError extends Error {}
export const requireScene: (project: ProjectData, sceneId: string) => SceneData
export const requireObject: (project: ProjectData, input: ObjectTargetInput) => { scene, object, index }
export const collectSubtreeIds: (objects: readonly SceneObject[], rootId: string) => Set<string>

// World-transform composition for the parentId hierarchy (transformMath.ts, no `three` import)
export const composeWorldTransform: (objects: readonly SceneObject[], objectId: string) => WorldTransform
export const localTransformForNewParent: (childWorld: WorldTransform, newParentWorld: WorldTransform) => TransformData
```

## Usage

Editor call sites never call the engine's free functions directly — they go through
[`src/editor/editorOperations.ts`](../../src/editor/editorOperations.ts), the thin policy layer
described above, which supplies a browser `crypto.randomUUID()`-based `ObjectIdFactory` and
editor-flavored names:

```ts
import {
  createEditorObject,
  moveEditorObjectCommand,
  reparentEditorObject,
  transformEditorObjectCommand,
} from './editor/editorOperations' // from src/

// Non-transform edits (create/duplicate/remove/rename/reparent/flags) commit a plain
// snapshot directly — no executeCommand involved:
const { project: withNewObject, objectId } = createEditorObject(project, sceneId, 'cube')
setProject(withNewObject)

// Transform edits (drag release, Inspector field change) go through the reversible
// command path so undo/redo and no-op suppression apply:
import { createCommandTimeline, executeCommand } from '@vthere/authoring-engine'

const timeline = createCommandTimeline(project, (p) => JSON.parse(JSON.stringify(p)) as ProjectData)
const builder = moveEditorObjectCommand(sceneId, objectId, [1, 0.55, 2])
const result = executeCommand(timeline, builder) // { status: 'committed' | 'unchanged' | 'rejected', error? }
if (result.status === 'committed') setProject(timeline.current)

// A single builder covers whichever transform channel the Inspector edited:
const builder2 = transformEditorObjectCommand(sceneId, objectId, { rotation: [0, 1.2, 0] })
if (builder2) executeCommand(timeline, builder2)
```

`App.tsx` is the real caller of this path end to end — it owns the live `CommandTimeline<ProjectData>`
and routes gizmo/Inspector edits through `executeCommand`, and non-transform edits (create,
duplicate, remove, rename, reparent, visibility/enabled toggles) through the plain
`timeline.commit(label, editorOperations.*(...).project)` pattern.

## Build sequence

### Engine slice 1: deterministic spatial primitives

- Define vectors, rays, planes, axis constraints, and transform deltas.
- Write table-driven tests for parallel rays, near-parallel rays, camera-facing axes, negative scale, and rotation wrap-around.
- Acceptance: identical inputs produce identical outputs without a browser or Three.js.

### Engine slice 2: gizmo hit testing

- Define handle geometry and screen-space tolerance.
- Keep handle size stable in screen pixels as camera distance changes.
- Test translation, rotation, and scale handle selection from multiple camera angles.
- Acceptance: the correct handle wins when handles overlap within tolerance, and misses do not start a drag.

### Engine slice 3: transform sessions

- Start from an immutable transform snapshot.
- Produce preview deltas without mutating the project.
- Commit exactly one command on pointer release; cancel produces no command.
- Acceptance: a drag cannot create one history entry per pointermove event.

### Engine slice 4: command timeline

- Add create, delete, transform, rename, and compound commands.
- Preserve dependent components/interactions in delete and undo snapshots.
- Clear redo after a new command following undo.
- Acceptance: delete -> undo restores the object and all dependent state; undo -> new edit makes redo unavailable.

### Engine slice 5: persistence checkpoints

- Emit a checkpoint only after a committed command or explicit save.
- Send immutable project snapshots to the injected `DraftPersistence` adapter.
- Keep engine tests independent from localStorage, IndexedDB, network, and PostgreSQL.
- Acceptance: failed persistence never changes command results or reports a successful save.

## Verification matrix

| Risk | Test | Required result |
|---|---|---|
| Camera looks down drag axis | constraint solver table test | stable fallback plane/axis behavior, no NaN |
| Pointer crosses rotation back side | rotation accumulation test | continuous angle, no jump |
| Pointer moves rapidly | session test | one command at release |
| Undo after compound delete | command test | object, components, and interactions restored |
| New edit after undo | history test | redo branch cleared |
| Corrupt current draft | persistence adapter test | valid backup recovered and surfaced |
| Autosave write failure | adapter contract test | failure state shown; export remains available |
| Older project schema | migration test | supported version migrates; unsupported version rejected |
| Published project edited | publication test | published snapshot remains unchanged |

## Definition of done

The component is complete for MVP when the editor can use it without direct project mutation, its unit tests pass without a browser, its command timeline survives save/load round trips, and the technical-spike scenario demonstrates object placement, manipulation, serialization, reload, undo, redo, and recovery from a failed current draft.
