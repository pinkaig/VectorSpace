# Authoring Engine

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

## Public API skeleton

```ts
export type GizmoMode = 'translate' | 'rotate' | 'scale'
export type TransformSpace = 'world' | 'local'

export interface AuthoringEngine {
  select(hit: SelectionHit | null): SelectionState
  beginTransform(input: TransformStart): TransformSession
  updateTransform(session: TransformSession, pointer: PointerSample): TransformPreview
  commitTransform(session: TransformSession): CommandResult
  cancelTransform(session: TransformSession): void
  execute(command: Command): CommandResult
  undo(): CommandResult
  redo(): CommandResult
  createCheckpoint(): ProjectCheckpoint
}

export interface TransformManipulator {
  begin(input: TransformStart): TransformSession
  update(session: TransformSession, pointer: PointerSample): TransformPreview
  finish(session: TransformSession): TransformDelta
}

export interface GizmoHitTest {
  hitTest(ray: Ray, camera: CameraFrame, mode: GizmoMode): GizmoHandle | null
}

export interface ConstraintSolver {
  projectToAxis(ray: Ray, axis: Axis, origin: Vector3): Scalar
  projectToPlane(ray: Ray, plane: Plane): Vector3
  resolveRotation(pointer: PointerSample, start: RotationStart): Angle
}

export interface CommandHistory {
  execute(command: Command): ProjectDocument
  undo(): ProjectDocument
  redo(): ProjectDocument
  canUndo(): boolean
  canRedo(): boolean
}
```

These are signatures only at skeleton stage. Implementations must remain inside this package and must not leak renderer or persistence types into the core API.

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
