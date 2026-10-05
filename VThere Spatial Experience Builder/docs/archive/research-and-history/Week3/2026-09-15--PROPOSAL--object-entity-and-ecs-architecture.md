# Object Entity and Hybrid ECS Architecture Proposal

**Status:** Proposed architecture addition; not yet adopted as an implementation contract  
**Date:** 2026-09-15  
**Scope:** VThere Spatial Experience Builder object ownership, hierarchy, lifecycle, rendering, and future ECS-style systems

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../../code/baseline-phases.md) for the full sequence.

## Decision summary

Adopt a **hybrid ECS-style object architecture** for the shared project model.
Keep the project as an immutable, versioned JSON document for editing,
serialization, undo/redo, import/export, and persistence. Add an ECS-oriented
entity/component view and query layer for runtime and renderer work.

Do not replace the current project document with a mutable global registry. The
Week 3 C++ ECS files are useful research for entity handles, component stores,
systems, and deferred deletion, but their global registry, numeric ID reuse, and
frame-oriented mutation model do not map directly to a browser editor that
needs deterministic snapshots and safe JSON recovery.

The target direction is:

```text
ProjectDocument / immutable editor state
        |
        | validated snapshot
        v
Entity index + component queries
        |
        +--> authoring commands and selection
        +--> hierarchy and visibility systems
        +--> Three.js render synchronizer
        +--> read-only visitor runtime
```

## Why this change is needed

The current `SceneObject` is a flat record inside `SceneData.objects`. It
already has a stable string ID, asset identity, name, and transform, but it
does not represent:

- render visibility;
- whether an object is enabled for authoring/runtime systems;
- parent-child relationships or groups;
- subtree lifecycle operations;
- a single command boundary for create, duplicate, and delete.

`App.tsx` currently performs object lookup and array replacement directly,
while `Viewport.tsx` reconstructs Three.js objects from the flat array. This is
acceptable for the prototype, but hierarchy and inherited state will become
fragile if each UI and renderer path implements its own rules.

The existing architecture already gives the change two useful boundaries:

- `packages/project` owns renderer-independent canonical data.
- `packages/authoring-engine` owns the future command and history boundary.

The new object architecture should extend those boundaries instead of adding a
second object model in React or Three.js.

## Target entity contract

The first implementation can preserve the public `SceneObject` name while
changing its meaning to an entity record with composable data.

```ts
export type EntityId = string

export interface EntityRecord {
  id: EntityId
  name: string
  parentId: EntityId | null
  enabled: boolean
  visible: boolean
  transform: TransformData // local transform relative to parent
  asset?: AssetComponent
  group?: GroupComponent
}

export interface AssetComponent {
  assetId: string
  assetKind: AssetKind
}

export interface GroupComponent {
  // Marker/data for an entity that is intentionally used as a group.
  // Child order remains derived from scene order, not duplicated here.
  isGroup: true
}
```

The exact component storage can be introduced later. The initial serialized
shape may remain a flat entity record to keep migration and human-readable JSON
simple. Internally, query helpers can expose component-like views:

```ts
interface EntityStore {
  get(id: EntityId): EntityRecord | undefined
  has(id: EntityId): boolean
  create(entity: EntityRecord): void
  update(id: EntityId, changes: Partial<EntityRecord>): void
  remove(id: EntityId): void
  query(predicate: (entity: EntityRecord) => boolean): EntityId[]
}
```

This is an index/access abstraction, not a second source of truth. It must be
rebuildable from a validated `SceneData` snapshot and must not be serialized
independently from the project document.

### Entity ID rules

- IDs are stable opaque strings, not array indexes and not display names.
- IDs must be unique within the whole project, matching the serializer's
  existing duplicate-object rejection rule.
- New entities receive collision-resistant IDs from one project-owned factory.
  `Date.now()` plus an array index is not sufficient once duplication and
  concurrent/server persistence exist.
- Duplication always creates a new entity ID. It copies component data and
  references only when the reference semantics explicitly allow it.
- Deleted IDs are not reused within an editable project version. This avoids
  stale selection, interaction, history, and server references resolving to a
  different object.
- Display names are not identity. Duplicate names are allowed, with a UI
  policy for readable suffixes.

## Visibility and activeness semantics

Visibility and activeness must be separate concepts.

| State | Meaning | Editor viewport | Visitor runtime |
| --- | --- | --- | --- |
| `visible` | The entity may be drawn. | Hide/show the entity and its descendants. | Hide/show the entity and its descendants. |
| `enabled` | The entity participates in systems and interactions. | It may remain visible but is not an active edit/runtime target. | It cannot receive interaction processing or runtime behaviour. |

An object can therefore be visible but disabled, which is useful for authoring
inspection and staged content. A disabled object should not be silently
removed from the scene or from serialization.

Effective state is inherited from ancestors:

```text
effectiveVisible(entity) = entity.visible && effectiveVisible(parent)
effectiveEnabled(entity) = entity.enabled && effectiveEnabled(parent)
```

The root scene has an implicit enabled and visible state. Store authored local
flags on each entity; calculate effective flags in a hierarchy/visibility
query. Do not write inherited values back into every child because that causes
large, noisy edits and makes re-parenting ambiguous.

Selection and editor affordances are separate from render visibility. A hidden
object cannot be selected from the viewport, but the scene tree may still
select it and reveal its hidden state. A selected disabled object may still be
inspected, but transform commands should be explicit about whether disabled
entities can be edited.

## Hierarchy and grouping

Use one serialized `parentId` relationship per entity. Do not serialize both
`parentId` and a `children` array; duplicated relationships will eventually
disagree. Child lists should be derived from scene order and indexed for query
performance.

```text
Scene
└── Gallery group (id: group-gallery)
    ├── Column (id: object-column)
    └── Sphere (id: object-sphere)
```

Rules:

- `parentId: null` means a direct child of the scene root.
- A parent must exist in the same scene. Cross-scene parenting is rejected.
- A parent cannot be its own ancestor. Re-parenting must reject cycles before
  committing a command.
- A group is an ordinary entity with `GroupComponent`; grouping does not
  require a special tree-only object type.
- A renderable object may also be a parent if the product wants an object and
  group pivot together. If that is confusing in the UI, the editor can create
  a non-renderable group entity and reparent the object beneath it.
- Child order is stable and meaningful for the scene tree, deterministic
  serialization, and later render ordering. Re-parenting must preserve an
  explicit insertion index or append deterministically.
- Local transforms are relative to the parent. World transforms are derived by
  walking the ancestor chain and composing matrices.
- Re-parenting should offer `keepWorldTransform` as the default editor option;
  an explicit `keepLocalTransform` option can support advanced workflows.

Validation must reject missing parents, cross-scene parents, cycles, duplicate
IDs, and invalid transform values. A malformed hierarchy must fail import
without replacing the current project.

## Lifecycle operations

All lifecycle operations are commands, not direct array edits in `App.tsx`.
They must produce an immutable next project snapshot and one history entry.

### Create

`CreateEntityCommand` should:

1. allocate a new ID;
2. create the requested asset or empty group record;
3. assign the requested parent or scene root;
4. calculate a deterministic insertion position;
5. select the new entity after commit;
6. support undo by removing only the created subtree and dependent state.

### Duplicate

`DuplicateEntityCommand` should duplicate the selected entity or selected
subtree:

- generate fresh IDs for every copied entity;
- remap copied parent IDs to the fresh IDs;
- preserve local transforms and child ordering;
- apply a small deterministic placement offset only if the UX requires it;
- define whether interactions, media, and external asset references are copied;
- select the duplicated root;
- undo the entire duplicate as one compound command.

### Delete

`DeleteEntityCommand` should delete the selected entity and descendants as one
subtree operation by default. Before committing it must capture:

- the complete subtree and original ordering;
- selection state;
- interactions/components that reference deleted entities;
- any parent relationship and local transforms.

The default policy should reject or explicitly resolve dangling references.
Silent reference loss is unsafe. For the first slice, deleting a referenced
entity can remove dependent interactions in the same compound command and show
the user a count. A future recovery/report flow can offer retain-as-unresolved
references instead.

Undo restores the exact IDs and relationships. Redo deletes the same captured
subtree rather than generating a new deletion interpretation.

## Systems and ownership

The following systems are proposed as framework-free TypeScript modules. They
operate on project snapshots or an injected entity index and return results;
they do not own React state or Three.js objects.

| System | Responsibility | Initial home |
| --- | --- | --- |
| `EntityStore` | ID lookup, creation, updates, removal, queries | `packages/project/` |
| `HierarchySystem` | Parent validation, child index, cycle checks, world transforms | `packages/project/` or future `packages/spatial/` |
| `VisibilitySystem` | Effective visible/enabled state and subtree propagation | future `packages/spatial/` or `packages/project/` |
| `ObjectCommandSystem` | Create, duplicate, re-parent, visibility, active, delete commands | `packages/authoring-engine/` |
| `SelectionSystem` | Selection IDs and valid selection after lifecycle changes | `packages/authoring-engine/` |
| `RenderSyncSystem` | Entity ID to Three.js `Object3D` mapping and incremental updates | `src/Viewport.tsx`, later `packages/presentation/` |
| `InteractionSystem` | Runtime triggers/actions filtered by effective enabled state | future `packages/interaction/` |

The browser editor should use the same command path for scene-tree buttons,
inspector toggles, viewport operations, duplicate shortcuts, and delete keys.
The visitor runtime should consume a validated read-only snapshot and run only
the systems needed for presentation and interaction.

## Renderer integration

`Viewport.tsx` should eventually maintain a `Map<EntityId, THREE.Object3D>`.
The renderer synchronizer should:

1. create a Three.js object when an entity is added;
2. update transform and effective visibility when data changes;
3. reparent the Three.js object when `parentId` changes;
4. remove and dispose resources when an entity is deleted;
5. keep selection outlines and gizmos outside the authored object hierarchy;
6. ignore disabled entities for picking and runtime interaction;
7. retain the current resource cleanup guarantees.

The map is a renderer cache, not project state. It must be disposable and
rebuildable after reload, scene changes, runtime entry, or WebGL context loss.
The current full `syncObjects` rebuild is a suitable first adapter, but the
entity ID map should be introduced before adding nested transforms so object
identity is not inferred from array position or mesh traversal.

## Serialization and migration

Adding `parentId`, `visible`, and `enabled` changes the project contract. Use a
new schema version rather than making the validator guess.

Proposed migration from schema 1 to schema 2:

```text
schemaVersion 1 SceneObject
  -> parentId: null
  -> visible: true
  -> enabled: true
  -> transform interpreted as a scene-root local transform
schemaVersion 2 entity record
```

The migration must preserve IDs, names, assets, ordering, and transforms. It
must be pure and tested independently from browser storage. New validation
should enforce:

- unique entity IDs across the project;
- valid boolean flags;
- valid parent references and no cycles;
- one scene owner per entity;
- valid group/entity component combinations;
- the existing scene/object count and file-size limits.

Export should write the canonical current version. Import should migrate only
explicitly supported older versions and reject unknown versions. Current-draft
and backup recovery must pass through the same migration and validation path.

## Integration roadmap

### Slice 1: canonical flags and identity

- Add `EntityId`, `parentId`, `visible`, and `enabled` to the project model.
- Replace timestamp-plus-index ID generation with a project-owned ID factory.
- Add serializer migration and validation tests.
- Add inspector toggles without changing hierarchy yet.

### Slice 2: hierarchy index and commands

- Add parent validation, child ordering, cycle detection, and world-transform
  helpers.
- Move create, rename, transform, visibility, enabled-state, and delete edits
  behind authoring-engine commands.
- Add duplicate and re-parent commands.
- Add subtree selection and delete/undo tests.

### Slice 3: scene tree and renderer adapter

- Render nested scene-tree rows from the hierarchy index.
- Add group creation, expand/collapse, visibility, and active-state controls.
- Add the `EntityId -> Object3D` cache in `Viewport.tsx`.
- Verify parent transforms, inherited flags, picking, gizmos, and resource
  disposal.

### Slice 4: runtime and interaction filtering

- Make runtime read effective visibility/enabled state from the shared model.
- Ensure disabled entities do not receive interaction events.
- Add preview/runtime parity tests using the same fixture project.
- Keep editor selection and authoring controls out of runtime.

### Slice 5: persistence/API adoption

- Add server-side schema validation and project ownership checks for the same
  entity contract.
- Store published snapshots immutably.
- Add conflict tests for concurrent edits and stale entity references.
- Keep localStorage as a draft adapter only.

## ECS-specific considerations

### Prefer stable handles over exposed array indexes

The C++ notes reuse numeric IDs and maintain pools. In this web app, IDs cross
React state, JSON files, undo snapshots, interaction references, and eventually
API versions. Use opaque stable IDs in the document and treat any numeric index
as an internal cache detail.

### Avoid a global singleton registry

The registry must be scoped to a project/scene snapshot or runtime session.
Global mutable state would make imported projects, multiple editor tabs, tests,
and runtime preview difficult to isolate. It would also conflict with the
existing defensive cloning and persistence recovery design.

### Use systems for policy, not for every data field

An ECS split is valuable when it separates transform, hierarchy, rendering, and
interaction policy. It is not valuable to turn every label or UI concern into a
runtime system. Keep simple identity and authored metadata close to the entity
record until real query or performance needs justify separate component stores.

### Defer structural mutation during system iteration

Runtime systems should queue create/delete/re-parent operations and apply them
at a defined command boundary. This avoids invalidating query results while a
frame is executing. The editor can apply a command immediately because React
renders a new immutable snapshot.

### Define system ordering explicitly

The initial order should be:

```text
load/validate -> hierarchy index -> effective state -> interaction/input
-> authoring command commit -> render synchronization -> persistence checkpoint
```

Do not make rendering responsible for hierarchy calculation or make the API
responsible for runtime frame updates.

### Keep the browser performance problem measurable

The current project limit is 5,000 objects, but Three.js draw calls and asset
complexity are the real constraints. Measure query cost, hierarchy updates,
render synchronization, memory disposal, and frame time before introducing
archetype/chunk storage. A sparse component store can be added behind the same
entity/query API if profiling shows that flat snapshot scans are insufficient.

### Plan for references beyond transforms

Future components will reference entity IDs for interaction targets, camera
viewpoints, zones, media panels, and navigation. The project validator should
eventually expose a reference index so delete, duplicate, and migration can
rewrite or report references consistently.

### Keep editor and runtime semantics aligned

Visibility, enabled state, parent transforms, and deletion must mean the same
thing in editor preview and published runtime. The editor may add selection,
outlines, hidden-object inspection, and authoring-only gizmos, but those are
presentation overlays rather than authored components.

## Acceptance criteria

This proposal is ready to implement when the team agrees on:

- whether `enabled` means "participates in all systems" or only runtime
  interaction;
- whether deleting a referenced entity removes dependent interactions or
  creates unresolved references;
- whether grouping creates non-renderable group entities by default;
- whether duplication copies interactions and content components;
- whether re-parenting preserves world or local transforms by default;
- the schema version and migration policy;
- the maximum hierarchy depth and object count for the MVP.

The first implementation milestone should demonstrate: create, duplicate,
select, hide, disable, group, re-parent, delete, undo, redo, save, reload, and
runtime preview using one stable entity/component contract.

## Related sources

- [Week 3 ECS header](ECS.h)
- [Week 3 ECS implementation](ECS.cpp)
- [Week 3 entity manager](EntityManager.h)
- [Week 3 scene manager](SceneManager.h)
- [Current project model](../../../packages/project/src/index.ts)
- [Current editor coordinator](../../../src/App.tsx)
- [Current viewport](../../../src/Viewport.tsx)
- [Project serialization contract](../../05-subsystems/project-serialization.md)
- [Authoring engine contract](../../05-subsystems/authoring-engine.md)
- [Current architecture guide](../../02-architecture/FOUNDATION--architecture.md)
