# Week 3 Session: ECS-Style Object Handling and Parent-Child Hierarchy

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../../code/baseline-phases.md) for the full sequence.

## Objective / Topic

Define and stage ECS-style object handling for the VThere Spatial Experience
Builder without replacing the immutable project snapshot with a mutable global
registry. Prepare the next implementation slice for parent-child objects,
hierarchy validation, subtree lifecycle operations, and derived renderer state.

## Decisions Made

- `packages/project` remains the canonical source of serialized project data.
- `ProjectData` and `SceneObject` are the authoritative authored state.
- Object lifecycle operations belong in `packages/authoring-engine` beside the
  existing command timeline.
- React state, Three.js objects, selection, and query indexes are derived or
  adapter state and must not become a second source of truth.
- Use stable opaque string IDs. Do not use array indexes or display names as
  identity.
- A future hierarchy should serialize one `parentId` per object. Do not store
  both `parentId` and a serialized `children` array.
- `parentId: null` means a direct child of the scene root.
- Parent validation must reject missing parents, cross-scene parents, and
  cycles.
- Child order is derived from scene object order or an explicitly defined
  insertion policy; it must remain deterministic.
- Local transforms are authored relative to the parent. World transforms are
  derived by the hierarchy layer.
- A future ECS/entity index must be rebuildable from a validated snapshot and
  must never be serialized as an independent authority.
- Do not create a singleton `ObjectManager` or copy the C++ global registry
  design into the browser application.

## Current Skeleton / Plan State

### Project package

`packages/project/src/index.ts` currently contains the canonical project,
scene, object, transform, environment, and camera types plus default
constructors and defensive cloning. Its commented pseudocode documents the
responsibility boundary and future fields, including `visible`, `enabled`,
`status`, and `parentId`.

Those future fields are not currently part of the executable `SceneObject`
schema. Adding them requires an explicit schema version and serializer
migration.

### Authoring engine

`packages/authoring-engine/src/index.ts` currently contains the generic
immutable `CommandTimeline` with commit, undo, redo, history limits, and
snapshot cloning.

The lifecycle tests already describe the intended next API:

- `ObjectIdFactory`;
- `ObjectOperationError`;
- `createObject`;
- `duplicateObject`;
- `removeObject`.

At the time of this handoff, those lifecycle functions are not exported by the
current authoring-engine implementation. The focused test currently reports:

```text
3 failed, 2 passed
TypeError: createObject is not a function
```

This mismatch is the first implementation task. Do not remove or weaken the
existing lifecycle tests to make the suite pass.

### Parent-child / ECS design

The broader proposal describes these future boundaries:

```text
ProjectData snapshot
    -> validated hierarchy index
    -> effective visibility/enabled queries
    -> authoring commands and selection
    -> renderer synchronization
    -> runtime interaction filtering
```

The first hierarchy implementation should remain a derived index over the flat
snapshot. It should not introduce a mutable registry before the serialized
contract and migration rules are approved.

## Implementation Plan

### Slice 1: restore object lifecycle operations

Implement the test-described operations in `packages/authoring-engine`:

```text
createObject(project, input, idFactory)
duplicateObject(project, input, idFactory)
removeObject(project, input)
```

Required behavior:

- clone the input project before changing it;
- validate scene and object targets;
- use `makeObject` for default object data;
- obtain new IDs from an injected factory;
- preserve source objects during duplication;
- return original object/index information for future undo;
- throw a typed error for invalid targets;
- avoid React, Three.js, storage, HTTP, or global state dependencies.

### Slice 2: introduce the hierarchy contract

After Slice 1 passes, propose a versioned model change:

```ts
SceneObject {
  id: string
  parentId: string | null
  transform: TransformData // local transform
  ...existing fields
}
```

Do not add this field silently. Add a schema migration from the current flat
schema that assigns `parentId: null` to every existing object and preserves
IDs, ordering, assets, and transforms.

### Slice 3: add pure hierarchy helpers

The future hierarchy module should expose pure operations similar to:

```text
buildChildIndex(scene)
validateParentChange(scene, objectId, nextParentId)
collectSubtree(scene, rootId)
getAncestors(scene, objectId)
computeWorldTransform(scene, objectId)
getEffectiveVisibility(scene, objectId)
getEffectiveEnabled(scene, objectId)
```

Expected rules:

- parent must belong to the same scene;
- object cannot parent itself;
- object cannot be reparented beneath its descendant;
- missing parents are invalid;
- traversal must detect malformed cycles instead of looping forever;
- inherited visibility/enabled values are derived, not written into children;
- world transform is derived from local transforms and ancestor order.

The module may begin in `packages/authoring-engine` if it is coupled to edit
commands, or in a future framework-free `packages/spatial` if transform and
hierarchy math gains a second consumer. Do not create `packages/spatial` only
for a one-consumer wrapper.

### Slice 4: hierarchy lifecycle commands

Add commands for:

- create under a parent or scene root;
- duplicate a complete subtree with remapped IDs;
- delete a subtree as one history entry;
- re-parent with an explicit `keepWorldTransform` or `keepLocalTransform`
  policy;
- preserve deterministic child order;
- restore exact IDs, parent links, local transforms, and order on undo.

Reference-bearing components must not be silently dropped. Until interactions,
media, and navigation exist, document the reference policy rather than inventing
one.

### Slice 5: renderer integration

Only after hierarchy commands and tests pass:

- build a disposable `EntityId -> THREE.Object3D` cache;
- update parent relationships in the renderer projection;
- apply effective visibility before drawing and picking;
- keep gizmos and selection outlines outside the authored hierarchy;
- dispose removed objects and rebuild the cache after reload or context loss.

## Build / Verify Command

Run from `VThere Spatial Experience Builder/`:

```powershell
npm.cmd test -- packages/authoring-engine/src/index.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Current verified focused status at handoff:

```text
packages/authoring-engine/src/index.test.ts
3 failed, 2 passed
Failure cause: lifecycle exports are missing from authoring-engine/src/index.ts
```

The known Vite large-chunk warning is unrelated to this hierarchy slice and
should be recorded rather than mixed into the implementation.

## Files Touched This Session

- `docs/07-research-and-history/Week3/SESSION.md`

Relevant existing files, not modified by this handoff:

- `packages/project/src/index.ts`
- `packages/authoring-engine/src/index.ts`
- `packages/authoring-engine/src/index.test.ts`
- `docs/07-research-and-history/Week3/2026-09-15--PROPOSAL--object-entity-and-ecs-architecture.md`
- `docs/07-research-and-history/Week3/2026-09-15--HANDOFF--object-lifecycle-scaffolding-and-next-agent-guide.md`
- `src/App.tsx`
- `src/Viewport.tsx`
- `src/serializer.ts`

## Failed or Rejected Approaches

- Do not place executable lifecycle operations in `packages/project` merely
  because it owns the object type.
- Do not create a global mutable `ObjectManager`.
- Do not replace the immutable project document with an ECS registry.
- Do not serialize both parent links and child arrays.
- Do not add hierarchy fields without a schema migration.
- Do not duplicate object state inside React, Three.js, or an ECS cache.
- Do not implement subtree deletion before defining reference behavior.
- Do not introduce a separate `packages/commands` or `packages/spatial` package
  before the contract has a stable second consumer.
- Do not copy numeric ID reuse and frame-oriented mutation from the C++ research
  files into the browser editor.

## Open Questions

- Should `visible` and `enabled` be added in the same schema migration as
  `parentId`, or in a preceding lifecycle migration?
- Should disabled objects remain transformable in the editor?
- Should grouping create non-renderable group objects by default?
- Should re-parenting preserve world transforms by default?
- What is the maximum hierarchy depth for the MVP?
- Should deleting referenced objects reject the command or create a compound
  command that removes dependent references?
- Should duplicate offsets be applied, and if so, what deterministic policy is
  expected?
- When should hierarchy math move from authoring-engine to `packages/spatial`?

## Next Recommended Step

Implement the missing lifecycle exports in `packages/authoring-engine`, make
the focused test pass without changing the project schema, then add a small
pure hierarchy validation/index test before introducing `parentId` migration.

Safe to `/clear`: yes.
